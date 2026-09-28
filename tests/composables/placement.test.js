import { describe, expect, it } from 'vitest'
import { placerEtiquettes } from '../../src/composables/placement.js'
import { contour } from '../../src/composables/formes.js'

describe('placerEtiquettes', () => {
  it('laisse en place des étiquettes qui ne se touchent pas', () => {
    const pos = placerEtiquettes([{ id: 'a', x: 0, y: 100, largeur: 40 }, { id: 'b', x: 200, y: 100, largeur: 40 }])
    expect(pos).toEqual({ a: 100, b: 100 })
  })

  it('remonte une étiquette qui en chevauche une autre', () => {
    const pos = placerEtiquettes([{ id: 'a', x: 0, y: 100, largeur: 80 }, { id: 'b', x: 30, y: 105, largeur: 80 }])
    expect(pos.b).toBe(69)
  })
})

describe('contour', () => {
  it('dessine toujours la même île pour la même graine', () => {
    expect(contour('aeronis', 0, 0, 20)).toBe(contour('aeronis', 0, 0, 20))
    expect(contour('aeronis', 0, 0, 20)).not.toBe(contour('skarn', 0, 0, 20))
  })
})
