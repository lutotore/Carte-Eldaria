import { describe, expect, it } from 'vitest'
import { empreinteJeton, genererJeton } from '../../src/securite/jetons.js'

describe('jetons', () => {
  it('génère des jetons longs, utilisables dans une URL et tous différents', () => {
    const jetons = new Set(Array.from({ length: 50 }, genererJeton))
    expect(jetons.size).toBe(50)
    for (const j of jetons) expect(j).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('calcule une empreinte stable qui ne révèle pas le jeton', () => {
    const jeton = genererJeton()
    expect(empreinteJeton(jeton)).toBe(empreinteJeton(jeton))
    expect(empreinteJeton(jeton)).not.toContain(jeton)
  })
})
