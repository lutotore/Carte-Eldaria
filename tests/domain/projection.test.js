import { describe, expect, it } from 'vitest'
import { versPublic } from '../../src/domain/projection.js'
import { unMonde } from './fabrique.js'

describe('versPublic', () => {
  const publique = versPublic(unMonde())
  const texte = JSON.stringify(publique)

  it("ne montre que les îles révélées", () => {
    expect(publique.iles.map((i) => i.id)).toEqual(['basse', 'haute', 'folle'])
  })

  it("masque l'altitude des îles non mesurées", () => {
    const haute = publique.iles.find((i) => i.id === 'haute')
    expect(haute.alt).toBeNull()
    expect(haute.historique).toEqual([])
  })

  it('ne montre que les missions sorties de l’ombre', () => {
    expect(publique.missions.map((m) => m.id)).toEqual(['principale', 'expe'])
  })

  it("ne laisse fuiter ni l'Horloge, ni les croyances, ni les notes du MJ", () => {
    expect(publique).not.toHaveProperty('horloge')
    expect(publique).not.toHaveProperty('croyances')
    expect(texte).not.toContain('spoiler')
    expect(texte).not.toContain('vitesse')
    expect(texte).not.toContain('Secrète')
  })

  it('calcule le niveau de la brume', () => {
    expect(publique.brume).toBe(1150)
  })
})
