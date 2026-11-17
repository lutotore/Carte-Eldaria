import { describe, expect, it } from 'vitest'
import { etiquetteDe, regrouper } from '../../src/domain/nouveautes.js'

describe('Quoi de neuf', () => {
  it('sépare ce qui est nouveau de ce qui a déjà été vu, dans le même ordre', () => {
    const liste = [{ id: 3, lue: false }, { id: 2, lue: true }, { id: 1, lue: false }]
    expect(regrouper(liste)).toEqual({ nouvelles: [{ id: 3, lue: false }, { id: 1, lue: false }], deja: [{ id: 2, lue: true }] })
  })

  it('donne une étiquette lisible à chaque catégorie', () => {
    expect(etiquetteDe('revelations')).toBe('Nouvelle information')
    expect(etiquetteDe('personnage')).toBe('Butin et fiche')
    expect(etiquetteDe('annonces')).toBe('Message du MJ')
    expect(etiquetteDe('carte')).toBe('Carte et Gazette')
    expect(etiquetteDe('seances')).toBe('Séances')
    expect(etiquetteDe('inconnue')).toBe('Nouveauté')
  })
})
