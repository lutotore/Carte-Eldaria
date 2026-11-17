import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, inscrire, portailDeTest } from './aides.js'

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const lea = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
  const autre = portail.initialiserCampagne({ nom: 'Autre' })
  portail.envoyerAnnonce({ demandeurId: tomId, campagneId, texte: 'On commence à 13 h.', destinataires: 'tous' })
  return { ...outils, campagneId, tomId, lea, autre }
}

describe('Quoi de neuf', () => {
  it("donne au joueur les nouveautés de cette campagne, avec leur catégorie et la date du monde", async () => {
    const { portail, campagneId, lea } = await table()
    const fil = portail.quoiDeNeuf({ demandeurId: lea, campagneId })
    expect(fil.liste).toEqual([expect.objectContaining({ texte: expect.stringContaining('On commence à 13 h.'), categorie: 'annonces', lue: false })])
    expect(fil.dateDuMonde).toMatchObject({ texte: expect.stringContaining('3207') })
  })

  it('ne montre pas les notifications des autres campagnes, et marque tout comme lu', async () => {
    const { portail, campagneId, lea } = await table()
    portail.quoiDeNeuf({ demandeurId: lea, campagneId })
    portail.marquerNouveautesLues({ demandeurId: lea, campagneId })
    expect(portail.quoiDeNeuf({ demandeurId: lea, campagneId }).liste.every((n) => n.lue)).toBe(true)
    expect(portail.notifications({ demandeurId: lea }).nonLues).toBe(0)
  })

  it("est réservé aux membres de la campagne", async () => {
    const { portail, autre, lea } = await table()
    expect(() => portail.quoiDeNeuf({ demandeurId: lea, campagneId: autre.campagneId })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })
})
