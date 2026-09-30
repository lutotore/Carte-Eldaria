import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, inscrire, portailDeTest } from './aides.js'

const STRYGE = {
  type: 'creature',
  nom: 'Stryge',
  facettes: { nature: 'Bête de taille TP', ca: '14 (armure naturelle)', pv: '2 (1d4)', vitesse: '3 m, vol 12 m', caracteristiques: 'FOR 4 (−3) · DEX 16 (+3)', sens: 'vision dans le noir 18 m' },
  capacites: [],
  actions: [{ titre: 'Absorption de sang', texte: '+5 au toucher, elle s’accroche.' }],
  reactions: [],
  secrets: [{ titre: 'Créature rêvée', texte: 'Elle naît de la brume.' }],
  notesMj: 'Puissance 1/8 (25 PX). Tactique : par deux ou trois.',
}

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = {}
  for (const [identifiant, role] of [['lea', 'joueur'], ['max', 'joueur'], ['ocre', 'occasionnel']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  const mj = { demandeurId: tomId, campagneId }
  portail.importerFiches(campagneId, { version: 1, fiches: [STRYGE] })
  const ficheId = portail.bibliotheque({ ...mj, type: 'creature' }).fiches[0].id
  const facette = (cle, titre) => portail.fiche({ ...mj, ficheId }).facettes.find((f) => f.cle === cle && (!titre || f.titre === titre))
  const reveler = (cle, cible = { pourTous: true }, titre) => portail.reveler({ ...mj, ficheId, facetteId: facette(cle, titre).id, ...cible })
  const vue = (qui) => portail.fiche({ demandeurId: ids[qui], campagneId, ficheId })
  return { ...outils, campagneId, tomId, ids, mj, ficheId, facette, reveler, vue }
}

describe('fiches de créature', () => {
  it('sont importées avec leur bloc de statistiques, leurs actions et leurs secrets, toutes cachées', async () => {
    const { portail, mj, ficheId, ids } = await table()
    const fiche = portail.fiche({ ...mj, ficheId })
    expect(fiche.type).toBe('creature')
    expect(fiche.facettes.map((f) => f.cle)).toEqual([
      'nom', 'portrait', 'nature', 'description', 'habitat', 'ca', 'pv', 'vitesse', 'caracteristiques', 'sauvegardes', 'competences', 'defenses', 'sens', 'langues', 'action', 'secret',
    ])
    expect(fiche.notesMj).toMatch(/Puissance 1\/8/)
    expect(portail.bibliotheque({ demandeurId: ids.lea, campagneId: mj.campagneId, type: 'creature' }).fiches).toEqual([])
  })

  it('sont séparées des PNJ dans les listes', async () => {
    const { portail, mj } = await table()
    portail.creerFiche({ ...mj, nom: 'Pip' })
    expect(portail.bibliotheque({ ...mj, type: 'pnj' }).fiches.map((f) => f.nom)).toEqual(['Pip'])
    expect(portail.bibliotheque({ ...mj, type: 'creature' }).fiches.map((f) => f.nom)).toEqual(['Stryge'])
  })

  it('se créent à la main, et reçoivent des capacités, actions et réactions', async () => {
    const { portail, mj } = await table()
    const { ficheId } = portail.creerFiche({ ...mj, nom: 'Veilleur creux', type: 'creature' })
    portail.ajouterTitree({ ...mj, ficheId, cle: 'capacite', titre: 'Regard qui sait', texte: 'Il connaît ta plus grande peur.' })
    portail.ajouterTitree({ ...mj, ficheId, cle: 'reaction', titre: 'Recul', texte: 'Il s’éloigne.' })
    expect(portail.fiche({ ...mj, ficheId }).facettes.slice(-2).map((f) => [f.cle, f.titre])).toEqual([['capacite', 'Regard qui sait'], ['reaction', 'Recul']])
    expect(() => portail.ajouterTitree({ ...mj, ficheId, cle: 'role', titre: 'x', texte: 'y' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it("refuse un type de fiche inconnu et une action sur un PNJ", async () => {
    const { portail, mj } = await table()
    expect(() => portail.creerFiche({ ...mj, nom: 'X', type: 'dragon' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    const { ficheId } = portail.creerFiche({ ...mj, nom: 'Pip' })
    expect(() => portail.ajouterTitree({ ...mj, ficheId, cle: 'action', titre: 'x', texte: 'y' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })
})

describe('les joueurs estiment les statistiques', () => {
  it("notent une estimation partagée, remplacée par la vraie valeur une fois révélée", async () => {
    const { portail, campagneId, ficheId, ids, reveler, vue } = await table()
    reveler('nom')
    portail.estimer({ demandeurId: ids.lea, campagneId, ficheId, cle: 'ca', texte: 'autour de 13' })
    let ligne = vue('max').grille.find((l) => l.cle === 'ca')
    expect(ligne).toMatchObject({ valeur: null, estimation: { texte: 'autour de 13', auteur: 'lea' } })
    reveler('ca')
    ligne = vue('max').grille.find((l) => l.cle === 'ca')
    expect(ligne).toMatchObject({ valeur: '14 (armure naturelle)', estimation: { texte: 'autour de 13' } })
  })

  it('peuvent effacer une estimation', async () => {
    const { portail, campagneId, ficheId, ids, reveler, vue } = await table()
    reveler('nom')
    portail.estimer({ demandeurId: ids.lea, campagneId, ficheId, cle: 'pv', texte: 'peu' })
    portail.estimer({ demandeurId: ids.max, campagneId, ficheId, cle: 'pv', texte: '' })
    expect(vue('lea').grille.find((l) => l.cle === 'pv').estimation).toBeNull()
  })

  it("n'estiment que les créatures qu'ils connaissent, et seulement les statistiques prévues", async () => {
    const { portail, campagneId, ficheId, ids, reveler } = await table()
    expect(() => portail.estimer({ demandeurId: ids.lea, campagneId, ficheId, cle: 'ca', texte: 'x' })).toThrow(expect.objectContaining({ code: 'introuvable' }))
    reveler('nom')
    expect(() => portail.estimer({ demandeurId: ids.lea, campagneId, ficheId, cle: 'notesMj', texte: 'x' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    expect(() => portail.estimer({ demandeurId: ids.lea, campagneId, ficheId, cle: 'ca', texte: 'x'.repeat(201) })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it("le MJ voit les estimations mais n'en écrit pas", async () => {
    const { portail, campagneId, ficheId, ids, reveler, mj } = await table()
    reveler('nom')
    portail.estimer({ demandeurId: ids.lea, campagneId, ficheId, cle: 'ca', texte: '12 ?' })
    expect(portail.fiche({ ...mj, ficheId }).estimations).toEqual({ ca: expect.objectContaining({ texte: '12 ?', auteur: 'lea' }) })
    expect(() => portail.estimer({ ...mj, ficheId, cle: 'ca', texte: 'x' })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })

  it("les estimations d'un PNJ n'existent pas", async () => {
    const { portail, campagneId, ids, mj } = await table()
    const { ficheId } = portail.creerFiche({ ...mj, nom: 'Pip' })
    const nom = portail.fiche({ ...mj, ficheId }).facettes.find((f) => f.cle === 'nom')
    portail.reveler({ ...mj, ficheId, facetteId: nom.id, pourTous: true })
    expect(() => portail.estimer({ demandeurId: ids.lea, campagneId, ficheId, cle: 'ca', texte: 'x' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })
})

describe('tout révéler au groupe', () => {
  it('révèle toutes les facettes remplies, et prévient chaque joueur une seule fois', async () => {
    const { portail, mj, ficheId, ids, vue } = await table()
    portail.revelerTout({ ...mj, ficheId })
    const fiche = vue('lea').fiche
    expect(fiche.nom).toBe('Stryge')
    expect(fiche.facettes.map((f) => f.cle)).toEqual(['nature', 'ca', 'pv', 'vitesse', 'caracteristiques', 'sens', 'action', 'secret'])
    expect(portail.notifications({ demandeurId: ids.lea }).liste).toHaveLength(1)
    expect(portail.notifications({ demandeurId: ids.ocre }).liste[0].texte).toBe('Nouvelle information : Stryge.')
    expect(JSON.stringify(vue('lea'))).not.toMatch(/Puissance/)
  })

  it('est réservé aux MJ', async () => {
    const { portail, campagneId, ficheId, ids } = await table()
    expect(() => portail.revelerTout({ demandeurId: ids.lea, campagneId, ficheId })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })
})

describe('RGPD', () => {
  it("l'export contient les estimations écrites ; la suppression du compte les efface", async () => {
    const { portail, db, campagneId, ficheId, ids, reveler } = await table()
    reveler('nom')
    portail.estimer({ demandeurId: ids.lea, campagneId, ficheId, cle: 'ca', texte: 'autour de 13' })
    expect(portail.exporterDonnees(ids.lea).estimations).toEqual([expect.objectContaining({ fiche: 'Stryge', statistique: "Classe d'armure", texte: 'autour de 13' })])
    await portail.supprimerCompte({ utilisateurId: ids.lea, motDePasse: 'une phrase de passe solide' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM estimations').get().n).toBe(0)
  })
})
