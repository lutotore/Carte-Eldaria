import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { MIGRATIONS, ouvrirBase } from '../../src/infra/base.js'

const tables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((t) => t.name)

describe('base de données', () => {
  let dossier
  afterEach(() => dossier && rmSync(dossier, { recursive: true, force: true }))

  it('crée le schéma à la première ouverture', () => {
    const db = ouvrirBase(':memory:')
    expect(tables(db)).toEqual(expect.arrayContaining([
      'campagnes', 'etats_campagne', 'invitations', 'participations', 'reinitialisations', 'sessions', 'utilisateurs',
    ]))
    expect(db.prepare('PRAGMA user_version').get().user_version).toBe(MIGRATIONS.length)
  })

  it('applique les clés étrangères', () => {
    const db = ouvrirBase(':memory:')
    expect(() => db.prepare("INSERT INTO participations (utilisateur_id, campagne_id, role, rejoint_le) VALUES (99, 99, 'joueur', 'd')").run()).toThrow()
  })

  it('ne rejoue pas les migrations déjà appliquées', () => {
    dossier = mkdtempSync(join(tmpdir(), 'eldaria-'))
    const chemin = join(dossier, 'test.db')
    const premiere = ouvrirBase(chemin)
    premiere.prepare("INSERT INTO campagnes (nom, cree_le) VALUES ('Eldaria', '2026-10-01')").run()
    premiere.close()
    const seconde = ouvrirBase(chemin)
    expect(seconde.prepare('SELECT nom FROM campagnes').all()).toHaveLength(1)
    seconde.close()
  })

  it('migre une base existante sans perdre le monde déjà enregistré', () => {
    dossier = mkdtempSync(join(tmpdir(), 'eldaria-'))
    const chemin = join(dossier, 'ancienne.db')
    // Base telle qu'elle est en production après la première mise en ligne (migration 1 seule).
    const ancienne = new DatabaseSync(chemin)
    ancienne.exec(MIGRATIONS[0])
    ancienne.exec('PRAGMA user_version = 1')
    ancienne.prepare("INSERT INTO campagnes (nom, cree_le) VALUES ('Eldaria', 'd')").run()
    ancienne.prepare("INSERT INTO etats_campagne (campagne_id, contenu, maj_le) VALUES (1, '{\"horloge\":3}', 'd')").run()
    ancienne.close()

    const migree = ouvrirBase(chemin)
    expect(migree.prepare('SELECT contenu, version FROM etats_campagne').get()).toEqual({ contenu: '{"horloge":3}', version: 1 })
    migree.close()
  })

  it('reconstruit la table des fiches (migration 5) sans rien perdre ni casser les liens', () => {
    dossier = mkdtempSync(join(tmpdir(), 'eldaria-'))
    const chemin = join(dossier, 'v4.db')
    const ancienne = new DatabaseSync(chemin)
    ancienne.exec('PRAGMA foreign_keys = ON')
    for (const migration of MIGRATIONS.slice(0, 4)) ancienne.exec(migration)
    ancienne.exec('PRAGMA user_version = 4')
    ancienne.exec(`
      INSERT INTO utilisateurs (identifiant, empreinte_mdp, cree_le) VALUES ('lea', 'x', 'd');
      INSERT INTO campagnes (nom, cree_le) VALUES ('Eldaria', 'd');
      INSERT INTO fiches (campagne_id, type, notes_mj, cree_le) VALUES (1, 'pnj', 'secret', 'd');
      INSERT INTO facettes (fiche_id, cle, valeur, ordre) VALUES (1, 'nom', 'Pip', 1);
      INSERT INTO notes (fiche_id, auteur_id, type, visibilite, texte, cree_le, maj_le) VALUES (1, 1, 'note', 'privee', 'hm', 'd', 'd');
    `)
    ancienne.close()

    const migree = ouvrirBase(chemin)
    expect(migree.prepare('SELECT type, notes_mj AS notesMj FROM fiches').get()).toEqual({ type: 'pnj', notesMj: 'secret' })
    expect(migree.prepare("INSERT INTO fiches (campagne_id, type, cree_le) VALUES (1, 'creature', 'd')").run().changes).toBe(1)
    expect(() => migree.prepare("INSERT INTO facettes (fiche_id, cle, valeur, ordre) VALUES (999, 'nom', 'x', 1)").run()).toThrow()
    migree.prepare('DELETE FROM fiches WHERE id = 1').run()
    expect(migree.prepare('SELECT COUNT(*) AS n FROM facettes').get().n).toBe(0)
    expect(migree.prepare('SELECT COUNT(*) AS n FROM notes').get().n).toBe(0)
    expect(migree.prepare('PRAGMA foreign_keys').get().foreign_keys).toBe(1)
    migree.close()
  })

  it('refuse un rôle inconnu', () => {
    const db = ouvrirBase(':memory:')
    db.prepare("INSERT INTO utilisateurs (identifiant, empreinte_mdp, cree_le) VALUES ('tom', 'x', 'd')").run()
    db.prepare("INSERT INTO campagnes (nom, cree_le) VALUES ('Eldaria', 'd')").run()
    expect(() => db.prepare("INSERT INTO participations (utilisateur_id, campagne_id, role, rejoint_le) VALUES (1, 1, 'roi', 'd')").run()).toThrow()
  })

  it('traite les identifiants sans tenir compte de la casse', () => {
    const db = ouvrirBase(':memory:')
    db.prepare("INSERT INTO utilisateurs (identifiant, empreinte_mdp, cree_le) VALUES ('Tom', 'x', 'd')").run()
    expect(() => db.prepare("INSERT INTO utilisateurs (identifiant, empreinte_mdp, cree_le) VALUES ('tom', 'x', 'd')").run()).toThrow(/UNIQUE/)
  })
})
