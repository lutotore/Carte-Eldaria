import { describe, expect, it } from 'vitest'
import { niveauBrume } from '../../src/domain/brume.js'

const regles = { base: 1150, monteeDes: 18, pas: 150 }

describe('niveauBrume', () => {
  it('reste à sa hauteur de base avant le seuil de montée', () => {
    expect(niveauBrume(0, regles)).toBe(1150)
    expect(niveauBrume(17, regles)).toBe(1150)
  })

  it("monte d'un pas dès le seuil, puis d'un pas par point", () => {
    expect(niveauBrume(18, regles)).toBe(1300)
    expect(niveauBrume(20, regles)).toBe(1600)
  })
})
