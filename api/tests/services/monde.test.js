import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, etatExemple, inscrire, portailDeTest } from './aides.js'

async function tableComplete() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const mjId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'co-mj', role: 'mj' })
  const joueurId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
  const occasionnelId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'max', role: 'occasionnel' })
  portail.importerEtat(campagneId, etatExemple())
  return { ...outils, campagneId, tomId, mjId, joueurId, occasionnelId }
}

describe('story 7 : le joueur voit la carte, sans aucune donnée du MJ', () => {
  it('reçoit la projection publique du monde', async () => {
    const { portail, campagneId, joueurId } = await tableComplete()
    const monde = portail.lireMonde({ demandeurId: joueurId, campagneId })
    expect(monde.iles.map((i) => i.id)).toEqual(['aeronis'])
    expect(monde.missions.map((m) => m.id)).toEqual(['m1'])
  })

  it('ne laisse filtrer aucun secret', async () => {
    const { portail, campagneId, joueurId, occasionnelId } = await tableComplete()
    for (const demandeurId of [joueurId, occasionnelId]) {
      const brut = JSON.stringify(portail.lireMonde({ demandeurId, campagneId }))
      expect(brut).not.toMatch(/SECRET|notesMJ|croyances|horloge/)
    }
  })

  it("refuse l'état complet à un joueur", async () => {
    const { portail, campagneId, joueurId } = await tableComplete()
    expect(() => portail.lireEtat({ demandeurId: joueurId, campagneId })).toThrow(expect.objectContaining({ code: 'interdit' }))
    expect(() => portail.ecrireEtat({ demandeurId: joueurId, campagneId, etat: etatExemple() })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })

  it("refuse la carte à quelqu'un qui n'est pas membre", async () => {
    const { portail, campagneId } = await tableComplete()
    const autre = portail.initialiserCampagne({ nom: 'Autre' })
    const { utilisateurId } = await portail.accepterInvitation(autre.jeton, { identifiant: 'etranger', motDePasse: 'une phrase de passe solide' })
    expect(() => portail.lireMonde({ demandeurId: utilisateurId, campagneId })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })

  it("signale une campagne dont le monde n'a pas encore été importé", async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    expect(() => portail.lireMonde({ demandeurId: tomId, campagneId })).toThrow(expect.objectContaining({ code: 'introuvable' }))
  })
})

describe('story 8 : le MJ voit et modifie toute la vérité', () => {
  it('lit l’état complet, secrets compris', async () => {
    const { portail, campagneId, tomId, mjId } = await tableComplete()
    for (const demandeurId of [tomId, mjId]) {
      expect(portail.lireEtat({ demandeurId, campagneId }).etat.iles.aeronis.notesMJ).toBe('SECRET-NOTE')
    }
  })

  it('enregistre un nouvel état, que les joueurs voient aussitôt', async () => {
    const { portail, campagneId, mjId, joueurId } = await tableComplete()
    const { etat, version } = portail.lireEtat({ demandeurId: mjId, campagneId })
    etat.iles.cachee.revelee = true
    portail.ecrireEtat({ demandeurId: mjId, campagneId, etat, versionAttendue: version })
    expect(portail.lireMonde({ demandeurId: joueurId, campagneId }).iles.map((i) => i.id)).toEqual(['aeronis', 'cachee'])
  })

  it('refuse un état incomplet sans rien écraser', async () => {
    const { portail, campagneId, tomId } = await tableComplete()
    const { version } = portail.lireEtat({ demandeurId: tomId, campagneId })
    expect(() => portail.ecrireEtat({ demandeurId: tomId, campagneId, etat: { horloge: 4 }, versionAttendue: version })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    expect(portail.lireEtat({ demandeurId: tomId, campagneId }).etat.horloge).toBe(3)
  })
})

describe("deux MJ ne s'écrasent pas l'un l'autre (verrou optimiste)", () => {
  it('numérote chaque version du monde', async () => {
    const { portail, campagneId, tomId } = await tableComplete()
    const lu = portail.lireEtat({ demandeurId: tomId, campagneId })
    const { version } = portail.ecrireEtat({ demandeurId: tomId, campagneId, etat: lu.etat, versionAttendue: lu.version })
    expect(version).toBe(lu.version + 1)
    expect(portail.lireEtat({ demandeurId: tomId, campagneId }).version).toBe(version)
  })

  it("refuse d'écrire sur une version que quelqu'un a modifiée entre-temps", async () => {
    const { portail, campagneId, tomId, mjId } = await tableComplete()
    const chezTom = portail.lireEtat({ demandeurId: tomId, campagneId })
    const chezCoMj = portail.lireEtat({ demandeurId: mjId, campagneId })

    chezCoMj.etat.horloge = 5
    portail.ecrireEtat({ demandeurId: mjId, campagneId, etat: chezCoMj.etat, versionAttendue: chezCoMj.version })

    chezTom.etat.horloge = 4
    expect(() => portail.ecrireEtat({ demandeurId: tomId, campagneId, etat: chezTom.etat, versionAttendue: chezTom.version }))
      .toThrow(expect.objectContaining({ code: 'conflit' }))
    expect(portail.lireEtat({ demandeurId: tomId, campagneId }).etat.horloge).toBe(5)
  })

  it('exige de dire sur quelle version on travaille', async () => {
    const { portail, campagneId, tomId } = await tableComplete()
    const { etat } = portail.lireEtat({ demandeurId: tomId, campagneId })
    expect(() => portail.ecrireEtat({ demandeurId: tomId, campagneId, etat })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it("fait passer un import à une nouvelle version : les tables ouvertes ne l'écraseront pas", async () => {
    const { portail, campagneId, tomId } = await tableComplete()
    const avant = portail.lireEtat({ demandeurId: tomId, campagneId })
    portail.importerEtat(campagneId, etatExemple())
    expect(() => portail.ecrireEtat({ demandeurId: tomId, campagneId, etat: avant.etat, versionAttendue: avant.version }))
      .toThrow(expect.objectContaining({ code: 'conflit' }))
  })
})

