import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, etatExemple, inscrire, portailDeTest } from './aides.js'

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 1)])
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)])

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = {}
  for (const [identifiant, role] of [['lea', 'joueur'], ['max', 'joueur'], ['ocre', 'occasionnel']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  portail.importerEtat(campagneId, etatExemple())
  const mj = { demandeurId: tomId, campagneId }
  portail.importerFiches(campagneId, { version: 1, fiches: [
    { type: 'lieu', nom: 'Le Pic Rouillé', ile: 'aeronis', facettes: { description: 'Une taverne enfumée.', ambiance: 'Odeur de bière.', acces: '' }, secrets: [{ titre: 'La cave', texte: 'Un passage vers la mine.' }], notesMj: 'Hulda.' },
    { type: 'document', nom: 'Aide de jeu n° 5 — La lettre', facettes: { description: 'Une lettre scellée.', texte: '« Ma petite étoile… »' }, notesMj: 'Dans la cabine.' },
  ] })
  const fiches = (type) => portail.bibliotheque({ ...mj, type }).fiches
  const lieuId = fiches('lieu')[0].id
  const docId = fiches('document')[0].id
  const facette = (ficheId, cle) => portail.fiche({ ...mj, ficheId }).facettes.find((f) => f.cle === cle)
  const reveler = (ficheId, cle, cible = { pourTous: true }) => portail.reveler({ ...mj, ficheId, facetteId: facette(ficheId, cle).id, ...cible })
  const vue = (qui, ficheId) => portail.fiche({ demandeurId: ids[qui], campagneId, ficheId })
  return { ...outils, campagneId, tomId, ids, mj, lieuId, docId, facette, reveler, vue, fiches }
}

describe('lieux reliés à la carte', () => {
  it("sont importés avec leur île, et le MJ voit la liste des îles pour en changer", async () => {
    const { portail, mj, lieuId } = await table()
    const fiche = portail.fiche({ ...mj, ficheId: lieuId })
    expect(fiche).toMatchObject({ type: 'lieu', ile: 'aeronis' })
    expect(fiche.iles).toEqual([{ id: 'aeronis', nom: 'Aéronis' }, { id: 'cachee', nom: 'Île cachée' }])
    portail.changerIle({ ...mj, ficheId: lieuId, ile: 'cachee' })
    expect(portail.fiche({ ...mj, ficheId: lieuId }).ile).toBe('cachee')
    portail.changerIle({ ...mj, ficheId: lieuId, ile: '' })
    expect(portail.fiche({ ...mj, ficheId: lieuId }).ile).toBeNull()
  })

  it("refusent une île inconnue, et l'île d'une fiche qui n'est pas un lieu", async () => {
    const { portail, mj, lieuId, docId } = await table()
    expect(() => portail.changerIle({ ...mj, ficheId: lieuId, ile: 'atlantide' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    expect(() => portail.changerIle({ ...mj, ficheId: docId, ile: 'aeronis' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it("indiquent leur île aux joueurs qui les connaissent", async () => {
    const { reveler, vue, lieuId, portail, ids, campagneId } = await table()
    reveler(lieuId, 'nom')
    expect(vue('lea', lieuId).fiche).toMatchObject({ nom: 'Le Pic Rouillé', ile: 'aeronis' })
    expect(portail.bibliotheque({ demandeurId: ids.lea, campagneId, type: 'lieu' }).fiches[0]).toMatchObject({ ile: 'aeronis', nomIle: 'Aéronis' })
    expect(vue('lea', lieuId).fiche.nomIle).toBe('Aéronis')
  })

  it("taisent aux joueurs une île qui n'est pas encore révélée sur la carte", async () => {
    const { reveler, vue, lieuId, portail, ids, campagneId, mj } = await table()
    portail.changerIle({ ...mj, ficheId: lieuId, ile: 'cachee' })
    reveler(lieuId, 'nom')
    expect(vue('lea', lieuId).fiche).toMatchObject({ ile: null, nomIle: null })
    expect(portail.bibliotheque({ demandeurId: ids.lea, campagneId, type: 'lieu' }).fiches[0]).toMatchObject({ ile: null, nomIle: null })
    expect(portail.bibliotheque({ ...mj, type: 'lieu' }).fiches[0]).toMatchObject({ ile: 'cachee', nomIle: 'Île cachée' })
  })
})

describe('documents (handouts)', () => {
  it('acceptent un PDF ou une image comme fichier, servi seulement si révélé', async () => {
    const { portail, mj, docId, reveler, ids, campagneId } = await table()
    const { imageId } = portail.definirPortrait({ ...mj, ficheId: docId, octets: PDF })
    expect(portail.lireImage({ ...mj, imageId }).type).toBe('application/pdf')
    expect(() => portail.lireImage({ demandeurId: ids.lea, campagneId, imageId })).toThrow(expect.objectContaining({ code: 'introuvable' }))
    reveler(docId, 'nom', { pourTous: false, joueurs: [ids.lea] })
    reveler(docId, 'fichier', { pourTous: false, joueurs: [ids.lea] })
    expect(portail.lireImage({ demandeurId: ids.lea, campagneId, imageId }).octets.equals(PDF)).toBe(true)
    expect(() => portail.lireImage({ demandeurId: ids.max, campagneId, imageId })).toThrow(expect.objectContaining({ code: 'introuvable' }))
  })

  it("indiquent s'il s'agit d'un PDF ou d'une image, pour l'afficher ou le proposer au téléchargement", async () => {
    const { portail, mj, docId, reveler, vue } = await table()
    expect(portail.fiche({ ...mj, ficheId: docId }).typeFichier).toBeNull()
    portail.definirPortrait({ ...mj, ficheId: docId, octets: PDF })
    expect(portail.fiche({ ...mj, ficheId: docId }).typeFichier).toBe('application/pdf')
    reveler(docId, 'nom')
    expect(vue('lea', docId).fiche.typeFichier).toBeNull()
    reveler(docId, 'fichier')
    expect(vue('lea', docId).fiche.typeFichier).toBe('application/pdf')
    portail.definirPortrait({ ...mj, ficheId: docId, octets: PNG })
    expect(vue('lea', docId).fiche.typeFichier).toBe('image/png')
  })

  it("préviennent le joueur à qui le MJ remet le fichier, même s'il connaissait déjà le document", async () => {
    const { portail, mj, docId, reveler, ids } = await table()
    portail.definirPortrait({ ...mj, ficheId: docId, octets: PDF })
    reveler(docId, 'nom', { pourTous: false, joueurs: [ids.lea] })
    const avant = portail.notifications({ demandeurId: ids.lea }).liste.length
    reveler(docId, 'fichier', { pourTous: false, joueurs: [ids.lea] })
    expect(portail.notifications({ demandeurId: ids.lea }).liste.length).toBe(avant + 1)
  })

  it('emportent leur fichier quand on les supprime', async () => {
    const { portail, mj, docId, images } = await table()
    const { imageId } = portail.definirPortrait({ ...mj, ficheId: docId, octets: PDF })
    portail.supprimerFiche({ ...mj, ficheId: docId })
    expect(() => portail.lireImage({ ...mj, imageId })).toThrow(expect.objectContaining({ code: 'introuvable' }))
    expect(images.lire(imageId)).toBeNull()
  })

  it("refusent un PDF comme portrait de PNJ ou de lieu", async () => {
    const { portail, mj, lieuId } = await table()
    expect(() => portail.definirPortrait({ ...mj, ficheId: lieuId, octets: PDF })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    expect(portail.definirPortrait({ ...mj, ficheId: lieuId, octets: PNG }).imageId).toBeDefined()
  })

  it('le destinataire partage lui-même le document avec le groupe', async () => {
    const { portail, docId, reveler, ids, campagneId, vue } = await table()
    reveler(docId, 'nom', { pourTous: false, joueurs: [ids.lea] })
    reveler(docId, 'texte', { pourTous: false, joueurs: [ids.lea] })
    expect(() => vue('max', docId)).toThrow(expect.objectContaining({ code: 'introuvable' }))
    portail.partager({ demandeurId: ids.lea, campagneId, ficheId: docId })
    expect(vue('max', docId).fiche).toMatchObject({ nom: 'Aide de jeu n° 5 — La lettre', facettes: [{ cle: 'texte', pourMoiSeul: false }] })
    expect(portail.notifications({ demandeurId: ids.max }).liste[0].texte).toBe('lea partage un document : Aide de jeu n° 5 — La lettre.')
    // La description, jamais montrée à Léa, reste cachée.
    expect(vue('max', docId).fiche.facettes.some((f) => f.cle === 'description')).toBe(false)
  })

  it("ne se partagent ni par quelqu'un qui ne les a pas, ni par un MJ, ni pour une autre fiche que les documents", async () => {
    const { portail, docId, lieuId, reveler, ids, campagneId, mj } = await table()
    expect(() => portail.partager({ demandeurId: ids.max, campagneId, ficheId: docId })).toThrow(expect.objectContaining({ code: 'introuvable' }))
    expect(() => portail.partager({ ...mj, ficheId: docId })).toThrow(expect.objectContaining({ code: 'interdit' }))
    reveler(lieuId, 'nom', { pourTous: false, joueurs: [ids.lea] })
    expect(() => portail.partager({ demandeurId: ids.lea, campagneId, ficheId: lieuId })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })
})
