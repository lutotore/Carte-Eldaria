import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, inscrire, portailDeTest } from './aides.js'

const refus = (code) => expect.objectContaining({ code })
const LIVRE = 'Livre du joueur'
const maitreDeGuerre = {
  type: 'sous-classe', id: 'maitre-de-guerre', classe: 'guerrier', nom: 'Maître de guerre', source: LIVRE, page: 80,
  aptitudes: { 3: ['Supériorité au combat'] }, choix: { 3: [{ liste: 'manoeuvres', nombre: 3 }] },
}
const manoeuvres = {
  type: 'liste', id: 'manoeuvres', nom: 'Manœuvre', source: LIVRE,
  options: [{ id: 'parade', nom: 'Parade' }, { id: 'riposte', nom: 'Riposte' }, { id: 'feinte', nom: 'Feinte' }],
}
const robuste = { type: 'don', id: 'robuste', nom: 'Robuste', source: LIVRE, page: 169, pvParNiveau: 2, resume: '+2 PV par niveau.' }

async function joueuse() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
  const qui = { demandeurId: leaId, campagneId }
  const personnageId = portail.creerPersonnage({ ...qui, nom: 'Isaure' }).personnageId
  portail.modifierPersonnage({ ...qui, personnageId, champs: { niveau: 2 } })
  portail.rattacherAuxRegles({ ...qui, personnageId, classe: 'guerrier' })
  return { ...outils, qui: { ...qui, personnageId } }
}

describe('règles des livres', () => {
  it('ajoutent leurs sous-classes et leurs dons à ceux du SRD', async () => {
    const { portail, qui } = await joueuse()
    expect(portail.importerRegles({ livre: LIVRE, elements: [maitreDeGuerre, manoeuvres, robuste] })).toEqual({ nombre: 3 })
    const { options } = portail.optionsMontee(qui)
    expect(options.sousClasse.map((s) => s.id)).toEqual(['champion', 'maitre-de-guerre'])
    expect(options.sousClasse[1].choix[0].options.map((o) => o.id)).toEqual(['parade', 'riposte', 'feinte'])
    portail.monterDeNiveau({ ...qui, demande: { classe: 'guerrier', sousClasse: 'maitre-de-guerre', choix: { manoeuvres: ['parade', 'riposte', 'feinte'] } } })
    expect(portail.optionsMontee(qui).options.amelioration.dons.map((d) => d.id)).toEqual(['lutteur', 'robuste'])
    expect(portail.livresDeRegles()).toEqual([{ livre: LIVRE, nombre: 3 }])
  })

  it('remplacent celles du même livre quand on le réimporte', async () => {
    const { portail } = await joueuse()
    portail.importerRegles({ livre: LIVRE, elements: [maitreDeGuerre, manoeuvres, robuste] })
    portail.importerRegles({ livre: LIVRE, elements: [robuste] })
    portail.importerRegles({ livre: 'Xanathar', elements: [{ ...robuste, id: 'robuste-bis', source: 'Xanathar' }] })
    expect(portail.livresDeRegles()).toEqual([{ livre: LIVRE, nombre: 1 }, { livre: 'Xanathar', nombre: 1 }])
  })

  it('refusent un fichier incohérent sans rien écrire', async () => {
    const { portail } = await joueuse()
    expect(() => portail.importerRegles({ livre: LIVRE, elements: [maitreDeGuerre] })).toThrow(refus('requete_invalide'))
    expect(() => portail.importerRegles({ livre: '', elements: [] })).toThrow(refus('requete_invalide'))
    expect(() => portail.importerRegles({ livre: LIVRE, elements: 'x' })).toThrow(refus('requete_invalide'))
    expect(() => portail.importerRegles({ livre: LIVRE, elements: [{ ...robuste, id: 'lutteur' }] })).toThrow(refus('requete_invalide'))
    expect(portail.livresDeRegles()).toEqual([])
  })
})
