import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, etatExemple, inscrire, portailDeTest } from './aides.js'

// Horloge des tests : lundi 5 octobre 2026, 22 h à Paris.
async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = { tom: tomId }
  for (const [identifiant, role] of [['lea', 'joueur'], ['max', 'joueur'], ['ocre', 'occasionnel']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  const textes = (nom) => portail.notifications({ demandeurId: ids[nom] }).liste.map((n) => n.texte)
  return { ...outils, campagneId, ids, textes }
}

/** Une séance le samedi 17 octobre 2026, de 14 h à 20 h. */
function fixerSeance(portail, { campagneId, ids }) {
  const { sondageId } = portail.ouvrirSondage({ demandeurId: ids.tom, campagneId, dates: ['2026-10-17'], lieu: 'Chez Tom' })
  const dateId = portail.planning({ demandeurId: ids.tom, campagneId }).sondage.dates[0].id
  portail.fixerSeance({ demandeurId: ids.tom, campagneId, sondageId, dateId, debut: '14:00', fin: '20:00', lieu: 'Chez Tom' })
}

describe('rappels de séance', () => {
  it('partent la veille à 18 h puis deux heures avant, à tous les membres, une seule fois', async () => {
    const outils = await table()
    const { portail, fixerHeure, textes } = outils
    fixerSeance(portail, outils)
    fixerHeure('2026-10-16T15:00:00Z')
    expect(portail.envoyerRappels()).toBe(0)
    fixerHeure('2026-10-16T16:05:00Z')
    expect(portail.envoyerRappels()).toBe(1)
    expect(portail.envoyerRappels()).toBe(0)
    expect(textes('ocre')[0]).toBe('Rappel : séance demain, samedi 17 octobre 2026, de 14 h à 20 h (Chez Tom).')
    expect(textes('tom')[0]).toBe('Rappel : séance demain, samedi 17 octobre 2026, de 14 h à 20 h (Chez Tom).')
    fixerHeure('2026-10-17T10:00:00Z')
    expect(portail.envoyerRappels()).toBe(1)
    expect(textes('lea')[0]).toMatch(/^La séance commence bientôt/)
  })

  it("ne rappelle pas une séance annulée", async () => {
    const outils = await table()
    const { portail, fixerHeure, ids, campagneId } = outils
    fixerSeance(portail, outils)
    const seanceId = portail.planning({ demandeurId: ids.tom, campagneId }).prochaineSeance.id
    portail.annulerSeance({ demandeurId: ids.tom, campagneId, seanceId })
    fixerHeure('2026-10-16T16:05:00Z')
    expect(portail.envoyerRappels()).toBe(0)
  })
})

describe('relance des sondages', () => {
  it('la veille de la date limite, seuls les joueurs qui n’ont pas répondu sont relancés', async () => {
    const { portail, fixerHeure, ids, campagneId, textes } = await table()
    const { sondageId } = portail.ouvrirSondage({ demandeurId: ids.tom, campagneId, dates: ['2026-10-17'], dateLimite: '2026-10-10' })
    const dateId = portail.planning({ demandeurId: ids.lea, campagneId }).sondage.dates[0].id
    portail.repondre({ demandeurId: ids.lea, campagneId, sondageId, reponses: [{ dateId, disponible: false }] })
    fixerHeure('2026-10-09T08:30:00Z')
    expect(portail.envoyerRappels()).toBe(1)
    expect(textes('max')[0]).toBe('Le sondage de dates se ferme demain (10 octobre) : pense à donner tes disponibilités.')
    expect(textes('lea')[0]).not.toMatch(/se ferme demain/)
    expect(textes('ocre')).toEqual([])
    expect(portail.envoyerRappels()).toBe(0)
  })
})

describe('rappels et identifiants réutilisés', () => {
  it('un nouveau sondage qui reprend le numéro d’un sondage supprimé est relancé quand même', async () => {
    const { portail, fixerHeure, ids, campagneId } = await table()
    const premier = portail.ouvrirSondage({ demandeurId: ids.tom, campagneId, dates: ['2026-10-17'], dateLimite: '2026-10-10' }).sondageId
    fixerHeure('2026-10-09T08:30:00Z')
    expect(portail.envoyerRappels()).toBe(1)
    portail.annulerSondage({ demandeurId: ids.tom, campagneId, sondageId: premier })
    fixerHeure('2026-10-12T08:00:00Z')
    const second = portail.ouvrirSondage({ demandeurId: ids.tom, campagneId, dates: ['2026-10-24'], dateLimite: '2026-10-15' }).sondageId
    fixerHeure('2026-10-14T08:30:00Z')
    expect(portail.envoyerRappels()).toBe(1)
    expect(second).toBeTypeOf('number')
  })
})

describe('nouveautés de la carte', () => {
  it('une nouvelle, une mission ou une île rendues visibles par la table du MJ préviennent les joueurs', async () => {
    const { portail, ids, campagneId, textes } = await table()
    portail.importerEtat(campagneId, etatExemple())
    const { etat, version } = portail.lireEtat({ demandeurId: ids.tom, campagneId })
    const suite = structuredClone(etat)
    suite.nouvelles = [{ t: 'Session 2', titre: 'Trois morts dans leur sommeil', texte: '…' }, ...(suite.nouvelles ?? [])]
    portail.ecrireEtat({ demandeurId: ids.tom, campagneId, etat: suite, versionAttendue: version })
    expect(textes('lea')).toEqual(['Gazette des Vents : Trois morts dans leur sommeil.'])
    expect(textes('tom')).toEqual([])
    const notification = portail.notifications({ demandeurId: ids.lea }).liste[0]
    expect(notification.lien).toBe(`/campagne/${campagneId}`)
  })

  it('un enregistrement sans changement visible ne prévient personne', async () => {
    const { portail, ids, campagneId, textes } = await table()
    portail.importerEtat(campagneId, etatExemple())
    const { etat, version } = portail.lireEtat({ demandeurId: ids.tom, campagneId })
    portail.ecrireEtat({ demandeurId: ids.tom, campagneId, etat: { ...etat, horloge: etat.horloge + 1 }, versionAttendue: version })
    expect(textes('lea')).toEqual([])
  })
})
