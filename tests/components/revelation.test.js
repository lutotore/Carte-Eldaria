import { describe, expect, it } from 'vitest'
import { basculer, FILTRES_REVELATION, garderSelon, modeDe } from '../../src/components/bibliotheque/revelation.js'

const auGroupe = [{ pourTous: true, utilisateurId: null }]
const a = (...ids) => ids.map((utilisateurId) => ({ pourTous: false, utilisateurId }))

describe("qui voit une information", () => {
  it('se lit dans ses révélations', () => {
    expect(modeDe([])).toBe('personne')
    expect(modeDe(auGroupe)).toBe('groupe')
    expect(modeDe(a(4, 5))).toBe('certains')
  })

  it("se bascule d'un clic : cachée ↔ groupe, et « certains » passe au groupe", () => {
    expect(basculer([])).toEqual({ pourTous: true, joueurs: [] })
    expect(basculer(auGroupe)).toEqual({ pourTous: false, joueurs: [] })
    expect(basculer(a(4))).toEqual({ pourTous: true, joueurs: [] })
  })
})

describe('le filtre de la bibliothèque du MJ', () => {
  const fiches = [{ id: 1, revelation: 'cache' }, { id: 2, revelation: 'partiel' }, { id: 3, revelation: 'revele' }]

  it('garde tout, ou les fiches encore cachées, en partie ou tout à fait révélées', () => {
    expect(FILTRES_REVELATION.map((f) => f.cle)).toEqual(['', 'cache', 'partiel', 'revele'])
    expect(garderSelon(fiches, '').map((f) => f.id)).toEqual([1, 2, 3])
    expect(garderSelon(fiches, 'cache').map((f) => f.id)).toEqual([1])
    expect(garderSelon(fiches, 'partiel').map((f) => f.id)).toEqual([2])
  })
})
