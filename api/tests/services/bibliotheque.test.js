import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, etatExemple, inscrire, portailDeTest } from './aides.js'

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)])

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = {}
  for (const [identifiant, role] of [['co-mj', 'mj'], ['lea', 'joueur'], ['max', 'joueur'], ['ocre', 'occasionnel']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  portail.importerEtat(campagneId, { ...etatExemple(), croyances: { fleau: 0, monde: 0, fusion: 0 }, regles: { ...etatExemple().regles, lectures: [{ cle: 'fleau', nom: 'Le Fléau' }, { cle: 'monde', nom: 'Le Monde blessé' }, { cle: 'fusion', nom: 'La Fusion' }] } })
  const mj = { demandeurId: tomId, campagneId }
  const { ficheId } = portail.creerFiche({ ...mj, nom: 'Isaure Mervent' })
  const facette = (cle) => portail.fiche({ ...mj, ficheId }).facettes.find((f) => f.cle === cle)
  const remplir = (cle, valeur) => portail.modifierFacette({ ...mj, ficheId, facetteId: facette(cle).id, valeur })
  const reveler = (cle, cible) => portail.reveler({ ...mj, ficheId, facetteId: facette(cle).id, ...cible })
  const vue = (qui) => portail.fiche({ demandeurId: ids[qui], campagneId, ficheId })
  return { ...outils, campagneId, tomId, ids, mj, ficheId, facette, remplir, reveler, vue }
}

describe('un MJ crée et remplit une fiche de PNJ', () => {
  it('crée toutes les facettes, vides sauf le nom, et rien n’est révélé', async () => {
    const { portail, mj, ficheId, ids } = await table()
    const fiche = portail.fiche({ ...mj, ficheId })
    expect(fiche.facettes.map((f) => [f.cle, f.valeur])).toEqual([
      ['nom', 'Isaure Mervent'], ['portrait', ''], ['role', ''], ['faction', ''], ['lieu', ''], ['attitude', ''], ['statut', ''], ['description', ''],
    ])
    expect(fiche.facettes.every((f) => f.revelations.length === 0)).toBe(true)
    expect(portail.bibliotheque({ demandeurId: ids.lea, campagneId: mj.campagneId }).fiches).toEqual([])
  })

  it('modifie les facettes, ajoute des secrets et des notes MJ', async () => {
    const { portail, mj, ficheId, remplir } = await table()
    remplir('attitude', 'neutre')
    portail.ajouterSecret({ ...mj, ficheId, titre: 'Sa mère', texte: 'Fille d’Élise Vauclair.' })
    portail.modifierNotesMj({ ...mj, ficheId, notesMj: 'Ne sourit qu’une fois par session.' })
    const fiche = portail.fiche({ ...mj, ficheId })
    expect(fiche.facettes.find((f) => f.cle === 'attitude').valeur).toBe('neutre')
    expect(fiche.facettes.at(-1)).toMatchObject({ cle: 'secret', titre: 'Sa mère', valeur: 'Fille d’Élise Vauclair.' })
    expect(fiche.notesMj).toBe('Ne sourit qu’une fois par session.')
  })

  it('refuse une valeur invalide', async () => {
    const { remplir } = await table()
    expect(() => remplir('attitude', 'amoureux')).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it('est réservé aux MJ', async () => {
    const { portail, campagneId, ficheId, ids, facette } = await table()
    expect(() => portail.creerFiche({ demandeurId: ids.lea, campagneId, nom: 'Intrus' })).toThrow(expect.objectContaining({ code: 'interdit' }))
    expect(() => portail.modifierFacette({ demandeurId: ids.lea, campagneId, ficheId, facetteId: facette('role').id, valeur: 'x' }))
      .toThrow(expect.objectContaining({ code: 'interdit' }))
  })

  it("ne touche jamais la fiche d'une autre campagne", async () => {
    const { portail, ficheId, facette } = await table()
    const autre = portail.initialiserCampagne({ nom: 'Autre' })
    const { utilisateurId } = await portail.accepterInvitation(autre.jeton, { identifiant: 'autre-mj', motDePasse: 'une phrase de passe solide' })
    expect(() => portail.modifierFacette({ demandeurId: utilisateurId, campagneId: autre.campagneId, ficheId, facetteId: facette('role').id, valeur: 'x' }))
      .toThrow(expect.objectContaining({ code: 'introuvable' }))
  })
})

describe('révélation morceau par morceau', () => {
  it('au groupe : joueurs et occasionnels voient la facette, et sont prévenus', async () => {
    const { portail, mj, reveler, vue, ids } = await table()
    reveler('nom', { pourTous: true })
    for (const qui of ['lea', 'max', 'ocre']) {
      expect(vue(qui).fiche).toMatchObject({ nom: 'Isaure Mervent', facettes: [] })
      expect(portail.notifications({ demandeurId: ids[qui] }).liste[0]).toMatchObject({ texte: 'Nouvelle information : Isaure Mervent.' })
    }
    expect(portail.bibliotheque({ demandeurId: ids.lea, campagneId: mj.campagneId }).fiches).toHaveLength(1)
  })

  it('à un seul joueur : les autres ne voient rien et ne sont pas prévenus', async () => {
    const { portail, remplir, reveler, vue, ids } = await table()
    remplir('role', 'Recruteuse')
    reveler('role', { pourTous: false, joueurs: [ids.lea] })
    expect(vue('lea').fiche).toMatchObject({ nom: null, facettes: [{ cle: 'role', valeur: 'Recruteuse', pourMoiSeul: true }] })
    expect(() => vue('max')).toThrow(expect.objectContaining({ code: 'introuvable' }))
    expect(portail.notifications({ demandeurId: ids.lea }).liste[0].texte).toBe('Nouvelle information : un personnage.')
    expect(portail.notifications({ demandeurId: ids.max }).liste).toEqual([])
  })

  it('peut être retirée (cacher à nouveau)', async () => {
    const { reveler, vue } = await table()
    reveler('nom', { pourTous: true })
    reveler('nom', { pourTous: false, joueurs: [] })
    expect(() => vue('lea')).toThrow(expect.objectContaining({ code: 'introuvable' }))
  })

  it('ne cible que des joueurs de la campagne, jamais un MJ', async () => {
    const { reveler, ids } = await table()
    expect(() => reveler('nom', { pourTous: false, joueurs: [ids['co-mj']] })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    expect(() => reveler('nom', { pourTous: false, joueurs: [9999] })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it('ne laisse jamais filtrer les notes MJ ni les secrets non révélés', async () => {
    const { portail, mj, ficheId, reveler, vue, ids } = await table()
    portail.ajouterSecret({ ...mj, ficheId, titre: 'Sa mère', texte: 'SECRET-FILLE' })
    portail.modifierNotesMj({ ...mj, ficheId, notesMj: 'SECRET-NOTE' })
    reveler('nom', { pourTous: true })
    expect(JSON.stringify(vue('lea'))).not.toMatch(/SECRET/)
    expect(JSON.stringify(portail.bibliotheque({ demandeurId: vue('lea').fiche.id && ids.lea, campagneId: mj.campagneId }))).not.toMatch(/SECRET/)
  })
})

describe('portraits', () => {
  it('sont servis au MJ, et aux joueurs seulement une fois révélés', async () => {
    const { portail, mj, ficheId, reveler, ids, facette } = await table()
    const { imageId } = portail.definirPortrait({ ...mj, ficheId, octets: PNG })
    expect(facette('portrait').valeur).toBe(imageId)
    expect(portail.lireImage({ ...mj, imageId })).toMatchObject({ type: 'image/png' })
    expect(() => portail.lireImage({ demandeurId: ids.lea, campagneId: mj.campagneId, imageId })).toThrow(expect.objectContaining({ code: 'introuvable' }))
    reveler('portrait', { pourTous: true })
    expect(portail.lireImage({ demandeurId: ids.lea, campagneId: mj.campagneId, imageId }).octets.equals(PNG)).toBe(true)
  })

  it("refusent ce qui n'est pas une image PNG, JPEG ou WebP, ou trop lourd", async () => {
    const { portail, mj, ficheId } = await table()
    expect(() => portail.definirPortrait({ ...mj, ficheId, octets: Buffer.from('<svg onload=alert(1)>') })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    const enorme = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)])
    expect(() => portail.definirPortrait({ ...mj, ficheId, octets: enorme })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it("remplacent l'ancien portrait, dont le fichier est effacé", async () => {
    const { portail, mj, ficheId, images } = await table()
    const premier = portail.definirPortrait({ ...mj, ficheId, octets: PNG })
    portail.definirPortrait({ ...mj, ficheId, octets: PNG })
    expect(images.lire(premier.imageId)).toBeNull()
  })
})

describe('notes et croyances des joueurs', () => {
  it('une note privée est vue de son auteur et des MJ, une note de groupe de tous ceux qui voient la fiche', async () => {
    const { portail, campagneId, ficheId, reveler, vue, ids, mj } = await table()
    reveler('nom', { pourTous: true })
    portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'note', visibilite: 'privee', texte: 'Elle me fait peur.' })
    portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'croyance', visibilite: 'groupe', texte: 'Elle cache un lien avec le Sillage.' })
    expect(vue('lea').notes.map((n) => n.texte)).toEqual(['Elle me fait peur.', 'Elle cache un lien avec le Sillage.'])
    expect(vue('max').notes.map((n) => n.texte)).toEqual(['Elle cache un lien avec le Sillage.'])
    expect(portail.fiche({ ...mj, ficheId }).notes).toHaveLength(2)
    expect(vue('max').notes[0]).toMatchObject({ auteur: 'lea', type: 'croyance', mienne: false })
  })

  it("interdit d'annoter une fiche qu'on ne voit pas", async () => {
    const { portail, campagneId, ficheId, ids } = await table()
    expect(() => portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'note', visibilite: 'privee', texte: 'x' }))
      .toThrow(expect.objectContaining({ code: 'introuvable' }))
  })

  it('seul son auteur modifie une note ; un MJ peut la supprimer', async () => {
    const { portail, campagneId, ficheId, reveler, ids, mj } = await table()
    reveler('nom', { pourTous: true })
    const { noteId } = portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'note', visibilite: 'groupe', texte: 'v1' })
    expect(() => portail.modifierNote({ demandeurId: ids.max, campagneId, noteId, texte: 'pirate', visibilite: 'groupe' })).toThrow(expect.objectContaining({ code: 'interdit' }))
    portail.modifierNote({ demandeurId: ids.lea, campagneId, noteId, texte: 'v2', visibilite: 'privee' })
    expect(portail.fiche({ ...mj, ficheId }).notes[0]).toMatchObject({ texte: 'v2', visibilite: 'privee' })
    portail.supprimerNote({ ...mj, noteId })
    expect(portail.fiche({ ...mj, ficheId }).notes).toEqual([])
  })

  it('le MJ compte une croyance dans le registre, une seule fois', async () => {
    const { portail, campagneId, ficheId, reveler, ids, mj } = await table()
    reveler('nom', { pourTous: true })
    const { noteId } = portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'croyance', visibilite: 'groupe', texte: "L'Abîme la manipule." })
    const avant = portail.lireEtat(mj).version
    portail.compterCroyance({ ...mj, noteId, lecture: 'fleau' })
    const { etat, version } = portail.lireEtat(mj)
    expect(etat.croyances.fleau).toBe(1)
    expect(JSON.stringify(etat.journal[0])).toMatch(/Abîme la manipule/)
    expect(version).toBe(avant + 1)
    expect(portail.fiche({ ...mj, ficheId }).notes[0]).toMatchObject({ lectureComptee: 'fleau' })
    expect(() => portail.compterCroyance({ ...mj, noteId, lecture: 'monde' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it("ne compte que les croyances, pas les simples notes, et seulement pour un MJ", async () => {
    const { portail, campagneId, ficheId, reveler, ids, mj } = await table()
    reveler('nom', { pourTous: true })
    const note = portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'note', visibilite: 'groupe', texte: 'x' })
    const croyance = portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'croyance', visibilite: 'groupe', texte: 'y' })
    expect(() => portail.compterCroyance({ ...mj, noteId: note.noteId, lecture: 'fleau' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    expect(() => portail.compterCroyance({ demandeurId: ids.lea, campagneId, noteId: croyance.noteId, lecture: 'fleau' })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })
})

describe('import des PNJ (ligne de commande)', () => {
  it('crée les fiches avec facettes, secrets et notes MJ, toutes cachées', async () => {
    const { portail, mj, ids } = await table()
    const { nombre } = portail.importerFiches(mj.campagneId, { version: 1, fiches: [{
      type: 'pnj', nom: 'Pip Cordelune',
      facettes: { role: 'Pilote', faction: '', lieu: 'Havrebrise', attitude: 'amical', statut: 'vivant', description: 'Halfelin jovial.' },
      secrets: [{ titre: 'Rêvé ?', texte: 'Il rêve de la Dormeuse.' }],
      notesMj: 'Voix enjouée.',
    }] })
    expect(nombre).toBe(1)
    const liste = portail.bibliotheque(mj).fiches
    expect(liste.map((f) => f.nom)).toEqual(['Isaure Mervent', 'Pip Cordelune'])
    const pip = portail.fiche({ ...mj, ficheId: liste[1].id })
    expect(pip.facettes.find((f) => f.cle === 'attitude').valeur).toBe('amical')
    expect(pip.facettes.at(-1)).toMatchObject({ cle: 'secret', titre: 'Rêvé ?' })
    expect(pip.notesMj).toBe('Voix enjouée.')
    expect(portail.bibliotheque({ demandeurId: ids.lea, campagneId: mj.campagneId }).fiches).toEqual([])
  })
})

describe('RGPD', () => {
  it("l'export ne révèle pas le vrai nom d'un PNJ encore inconnu de l'auteur", async () => {
    const { portail, campagneId, ficheId, remplir, reveler, ids } = await table()
    remplir('role', 'Recruteuse')
    reveler('role', { pourTous: true })
    portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'note', visibilite: 'privee', texte: 'Qui est-ce ?' })
    expect(portail.exporterDonnees(ids.lea).notes[0].fiche).toBe('un personnage inconnu')
  })

  it("l'export contient les notes écrites ; la suppression du compte les efface", async () => {
    const { portail, db, campagneId, ficheId, reveler, ids } = await table()
    reveler('nom', { pourTous: true })
    portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'croyance', visibilite: 'privee', texte: 'Elle ment.' })
    expect(portail.exporterDonnees(ids.lea).notes).toEqual([expect.objectContaining({ fiche: 'Isaure Mervent', type: 'croyance', texte: 'Elle ment.' })])
    await portail.supprimerCompte({ utilisateurId: ids.lea, motDePasse: 'une phrase de passe solide' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM notes').get().n).toBe(0)
  })
})

describe('un joueur retiré de la campagne', () => {
  it('ne peut plus modifier ses notes, mais peut encore les supprimer', async () => {
    const { portail, campagneId, ficheId, reveler, ids, tomId } = await table()
    reveler('nom', { pourTous: true })
    const { noteId } = portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'note', visibilite: 'privee', texte: 'v1' })
    portail.retirerMembre({ demandeurId: tomId, campagneId, cibleId: ids.lea })
    expect(() => portail.modifierNote({ demandeurId: ids.lea, campagneId, noteId, texte: 'v2', visibilite: 'groupe' })).toThrow(expect.objectContaining({ code: 'interdit' }))
    portail.supprimerNote({ demandeurId: ids.lea, campagneId, noteId })
  })

  it("perd les révélations qui lui étaient destinées, et l'export ne lui apprend rien de nouveau", async () => {
    const { portail, db, campagneId, ficheId, reveler, remplir, ids, tomId } = await table()
    remplir('role', 'Recruteuse')
    reveler('role', { pourTous: false, joueurs: [ids.lea] })
    portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'note', visibilite: 'privee', texte: 'Qui ?' })
    portail.retirerMembre({ demandeurId: tomId, campagneId, cibleId: ids.lea })
    expect(db.prepare('SELECT COUNT(*) AS n FROM revelations WHERE utilisateur_id = ?').get(ids.lea).n).toBe(0)
    reveler('nom', { pourTous: true })
    expect(portail.exporterDonnees(ids.lea).notes[0].fiche).toBe('un personnage inconnu')
  })
})

describe('garde-fous du registre et des portraits', () => {
  it('refuse une lecture inconnue, même au nom trompeur', async () => {
    const { portail, campagneId, ficheId, reveler, ids, mj } = await table()
    reveler('nom', { pourTous: true })
    const { noteId } = portail.ajouterNote({ demandeurId: ids.lea, campagneId, ficheId, type: 'croyance', visibilite: 'groupe', texte: 'x' })
    for (const lecture of ['toString', '__proto__', 'inexistante', 42]) {
      expect(() => portail.compterCroyance({ ...mj, noteId, lecture })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    }
    expect(portail.lireEtat(mj).etat.croyances).toEqual({ fleau: 0, monde: 0, fusion: 0 })
  })

  it("explique qu'il faut envoyer une image quand le corps n'en est pas une", async () => {
    const { portail, mj, ficheId } = await table()
    expect(() => portail.definirPortrait({ ...mj, ficheId, octets: { nom: 'x' } })).toThrow(expect.objectContaining({ message: 'Envoie une image PNG, JPEG ou WebP.' }))
  })
})

