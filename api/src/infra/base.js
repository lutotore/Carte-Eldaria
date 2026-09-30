import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Migrations numérotées : la base retient la dernière appliquée (PRAGMA user_version).
 * Règle d'or : on n'édite jamais une migration publiée, on en ajoute une nouvelle à la fin.
 */
export const MIGRATIONS = [
  `
  CREATE TABLE utilisateurs (
    id            INTEGER PRIMARY KEY,
    identifiant   TEXT NOT NULL UNIQUE COLLATE NOCASE,
    empreinte_mdp TEXT NOT NULL,
    cree_le       TEXT NOT NULL
  );

  CREATE TABLE campagnes (
    id      INTEGER PRIMARY KEY,
    nom     TEXT NOT NULL,
    cree_le TEXT NOT NULL
  );

  CREATE TABLE participations (
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    campagne_id    INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    role           TEXT NOT NULL CHECK (role IN ('proprietaire', 'mj', 'joueur', 'occasionnel')),
    rejoint_le     TEXT NOT NULL,
    PRIMARY KEY (utilisateur_id, campagne_id)
  );

  CREATE TABLE invitations (
    id              INTEGER PRIMARY KEY,
    campagne_id     INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('proprietaire', 'mj', 'joueur', 'occasionnel')),
    empreinte_jeton TEXT NOT NULL UNIQUE,
    expire_le       TEXT NOT NULL,
    utilise_le      TEXT,
    cree_le         TEXT NOT NULL
  );

  CREATE TABLE reinitialisations (
    id              INTEGER PRIMARY KEY,
    utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    empreinte_jeton TEXT NOT NULL UNIQUE,
    expire_le       TEXT NOT NULL,
    utilise_le      TEXT,
    cree_le         TEXT NOT NULL
  );

  CREATE TABLE sessions (
    empreinte_jeton TEXT PRIMARY KEY,
    utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    expire_le       TEXT NOT NULL,
    cree_le         TEXT NOT NULL
  );
  CREATE INDEX sessions_par_utilisateur ON sessions (utilisateur_id);

  CREATE TABLE etats_campagne (
    campagne_id INTEGER PRIMARY KEY REFERENCES campagnes(id) ON DELETE CASCADE,
    contenu     TEXT NOT NULL,
    maj_le      TEXT NOT NULL
  );
  `,
  // 2 — verrou optimiste : chaque écriture du monde incrémente sa version.
  `
  ALTER TABLE etats_campagne ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  `,
]

export function ouvrirBase(chemin) {
  if (chemin !== ':memory:') mkdirSync(dirname(chemin), { recursive: true })
  const db = new DatabaseSync(chemin)
  db.exec('PRAGMA foreign_keys = ON')
  if (chemin !== ':memory:') {
    // WAL : les lectures ne bloquent pas l'écriture. busy_timeout : patiente au lieu d'échouer.
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA busy_timeout = 5000')
  }
  migrer(db)
  return db
}

function migrer(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version
  for (let i = version; i < MIGRATIONS.length; i += 1) {
    transaction(db, () => {
      db.exec(MIGRATIONS[i])
      db.exec(`PRAGMA user_version = ${i + 1}`)
    })
  }
}

/** Exécute `travail` d'un bloc : tout est écrit, ou rien. */
export function transaction(db, travail) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const resultat = travail()
    db.exec('COMMIT')
    return resultat
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }
}
