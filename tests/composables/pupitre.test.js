import { describe, expect, it } from 'vitest'
import { memoireDuPupitre, sceneBornee } from '../../src/composables/pupitre.js'

function stockageDeTest() {
  const valeurs = new Map()
  return { getItem: (cle) => valeurs.get(cle) ?? null, setItem: (cle, valeur) => valeurs.set(cle, String(valeur)) }
}

describe('le pupitre se souvient, par campagne et sur cet appareil', () => {
  it("s'il est ouvert, et de la scène en cours", () => {
    const memoire = memoireDuPupitre(stockageDeTest())
    expect(memoire.lire('3')).toEqual({ ouvert: false, scene: 0 })
    memoire.ecrire('3', { ouvert: true, scene: 4 })
    expect(memoire.lire('3')).toEqual({ ouvert: true, scene: 4 })
    expect(memoire.lire('7')).toEqual({ ouvert: false, scene: 0 })
  })

  it('reste utilisable si le navigateur refuse le stockage', () => {
    const refuse = { getItem: () => { throw new Error('non') }, setItem: () => { throw new Error('non') } }
    const memoire = memoireDuPupitre(refuse)
    memoire.ecrire('3', { ouvert: true, scene: 2 })
    expect(memoire.lire('3')).toEqual({ ouvert: false, scene: 0 })
    expect(memoireDuPupitre(null).lire('3')).toEqual({ ouvert: false, scene: 0 })
  })

  it('ignore une valeur abîmée', () => {
    const stockage = stockageDeTest()
    stockage.setItem('eldaria:pupitre:3', '{pas du json')
    expect(memoireDuPupitre(stockage).lire('3')).toEqual({ ouvert: false, scene: 0 })
  })
})

describe('la scène en cours', () => {
  it('reste dans les bornes quand la liste change', () => {
    expect(sceneBornee(4, 7)).toBe(4)
    expect(sceneBornee(9, 7)).toBe(6)
    expect(sceneBornee(-1, 7)).toBe(0)
    expect(sceneBornee(3, 0)).toBe(0)
  })
})
