import { describe, expect, it } from 'vitest'
import { estActif, liensDuPortail } from '../../src/components/navigation.js'

const campagne = (role) => ({ id: 3, nom: 'Eldaria', role })
const noms = (liens) => liens.map((l) => l.cle)

describe('les liens du portail', () => {
  it("d'un joueur : sa fiche, et pas de table du MJ ni de membres", () => {
    const liens = liensDuPortail(campagne('joueur'))
    expect(noms(liens)).toEqual(['carte', 'nouveautes', 'seances', 'calendrier', 'bibliotheque', 'personnage', 'butins'])
    expect(liens.find((l) => l.cle === 'personnage')).toMatchObject({ nom: 'Ma fiche', to: { name: 'personnage', params: { id: 3 } } })
  })

  it("d'un MJ propriétaire : les personnages, la table du MJ et les membres", () => {
    expect(noms(liensDuPortail(campagne('proprietaire')))).toEqual(
      ['carte', 'nouveautes', 'seances', 'calendrier', 'bibliotheque', 'personnages', 'butins', 'mj', 'membres'])
  })

  it("« Quoi de neuf » n'ajoute rien à la barre du haut", () => {
    expect(liensDuPortail(campagne('joueur')).find((l) => l.cle === 'nouveautes').enHaut).toBe(false)
  })

  it('sur téléphone, cinq places en bas : quatre liens et « Plus »', () => {
    const enBas = liensDuPortail(campagne('joueur')).filter((l) => l.enBas)
    expect(noms(enBas)).toEqual(['carte', 'bibliotheque', 'personnage', 'butins'])
    expect(enBas.every((l) => l.court && l.icone)).toBe(true)
  })
})

describe('le lien actif', () => {
  const [carte, , , , bibliotheque, , butins] = liensDuPortail(campagne('joueur'))

  it('suit la page ouverte, rubriques de la bibliothèque comprises', () => {
    expect(estActif(carte, { name: 'carte', meta: {} })).toBe(true)
    expect(estActif(carte, { name: 'butins', meta: {} })).toBe(false)
    expect(estActif(bibliotheque, { name: 'bestiaire', meta: { bibliotheque: true } })).toBe(true)
    expect(estActif(butins, { name: 'butins', meta: {} })).toBe(true)
  })
})
