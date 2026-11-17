import { describe, expect, it } from 'vitest'
import {
  erreurScene, etatDesFacettes, facettesVisees, phraseDecouvertes, resumeSelecteurs,
} from '../../src/domain/scenes.js'

const facette = (id, cle, valeur, revelations = [], titre = null) => ({ id, cle, titre, valeur, revelations })
const auGroupe = [{ pourTous: true, utilisateurId: null }]
const a = (utilisateurId) => [{ pourTous: false, utilisateurId }]

const fileur = [
  facette(1, 'nom', 'Fileur de brume'),
  facette(2, 'portrait', ''),
  facette(3, 'description', 'Une ombre à contretemps.'),
  facette(4, 'habitat', ''),
  facette(5, 'secret', 'La lumière d’une Larme la dissipe.', [], 'Faiblesse'),
  facette(6, 'secret', 'Née du rêve de Garrec.', [], 'Origine'),
]

describe('les facettes visées par un élément de scène', () => {
  it('sont toutes celles qui sont remplies quand on ne précise rien', () => {
    expect(facettesVisees(fileur, []).map((f) => f.id)).toEqual([1, 3, 5, 6])
    expect(facettesVisees(fileur, undefined).map((f) => f.id)).toEqual([1, 3, 5, 6])
  })

  it('se choisissent par clé, et par titre pour les facettes titrées', () => {
    expect(facettesVisees(fileur, ['nom', 'secret:Faiblesse']).map((f) => f.id)).toEqual([1, 5])
    expect(facettesVisees(fileur, ['secret']).map((f) => f.id)).toEqual([5, 6])
  })

  it('ignorent ce qui est vide', () => {
    expect(facettesVisees(fileur, ['nom', 'habitat']).map((f) => f.id)).toEqual([1])
  })
})

describe("l'état d'un élément de scène", () => {
  it('est caché, partiel ou révélé au groupe', () => {
    expect(etatDesFacettes([facette(1, 'nom', 'x'), facette(2, 'description', 'y')])).toBe('cache')
    expect(etatDesFacettes([facette(1, 'nom', 'x', auGroupe), facette(2, 'description', 'y')])).toBe('partiel')
    expect(etatDesFacettes([facette(1, 'nom', 'x', a(7)), facette(2, 'description', 'y', a(7))])).toBe('partiel')
    expect(etatDesFacettes([facette(1, 'nom', 'x', auGroupe), facette(2, 'description', 'y', auGroupe)])).toBe('revele')
  })

  it("est vide quand il n'y a rien à révéler", () => {
    expect(etatDesFacettes([])).toBe('vide')
  })
})

describe('le résumé de ce qu’un élément révèle', () => {
  it('dit « Tout » sans précision, sinon nomme les facettes', () => {
    expect(resumeSelecteurs('creature', [])).toBe('Tout ce qui est rempli')
    expect(resumeSelecteurs('creature', ['nom', 'description', 'secret:Faiblesse'])).toBe('Nom, Description, Faiblesse')
    expect(resumeSelecteurs('lieu', ['portrait'])).toBe('Illustration')
    expect(resumeSelecteurs('pnj', ['secret'])).toBe('Secrets')
  })
})

describe('la phrase qui annonce les découvertes', () => {
  it('parle d’une ou de plusieurs fiches', () => {
    expect(phraseDecouvertes(['Fileur de brume'])).toBe('Nouvelle information : Fileur de brume.')
    expect(phraseDecouvertes(['A', 'B'])).toBe('Nouvelles informations : A et B.')
    expect(phraseDecouvertes(['A', 'B', 'C'])).toBe('Nouvelles informations : A, B et C.')
  })

  it('reste courte au-delà de quatre fiches', () => {
    expect(phraseDecouvertes(['A', 'B', 'C', 'D', 'E', 'F'])).toBe('Nouvelles informations : A, B, C et 3 autres.')
  })
})

describe('une scène préparée', () => {
  const valide = { titre: 'Le Nid des Fileurs', sousTitre: 'Salle 1', elements: [{ ficheId: 3, facettes: ['nom'] }], suite: '' }

  it('a un titre et des éléments bien formés', () => {
    expect(erreurScene(valide)).toBeNull()
    expect(erreurScene({ ...valide, elements: [] })).toBeNull()
    expect(erreurScene({ ...valide, titre: ' ' })).toMatch(/titre/)
    expect(erreurScene({ ...valide, titre: 'x'.repeat(121) })).toMatch(/titre/)
    expect(erreurScene({ ...valide, elements: [{ ficheId: 'trois' }] })).toMatch(/élément/)
    expect(erreurScene({ ...valide, elements: [{ ficheId: 3, facettes: [12] }] })).toMatch(/élément/)
    expect(erreurScene({ ...valide, elements: 'non' })).toMatch(/élément/)
    expect(erreurScene({ ...valide, suite: 'x'.repeat(2001) })).toMatch(/suite/)
  })
})
