import { describe, expect, it } from 'vitest'
import { RUBRIQUES, lieuxParIle, rubriqueDe } from '../../src/components/bibliotheque/rubriques.js'

describe('rubriques de la bibliothèque', () => {
  it('chaque type de fiche a sa liste et sa page de fiche, dans l’ordre des onglets', () => {
    expect(RUBRIQUES.map((r) => r.type)).toEqual(['pnj', 'creature', 'lieu', 'document'])
    expect(rubriqueDe('lieu')).toMatchObject({ liste: 'lieux', fiche: 'lieu', onglet: 'Lieux' })
    expect(rubriqueDe('document')).toMatchObject({ liste: 'documents', fiche: 'document', onglet: 'Documents' })
  })

  it('un type inconnu retombe sur les PNJ plutôt que sur une page vide', () => {
    expect(rubriqueDe('objet').type).toBe('pnj')
    expect(rubriqueDe(undefined).type).toBe('pnj')
  })
})

describe('lieuxParIle', () => {
  it("range les lieux connus par île, triés par nom, et ignore ceux qu'on ne sait pas situer", () => {
    const fiches = [
      { id: 1, nom: 'Taverne du Pic', ile: 'aeronis' },
      { id: 2, nom: 'Docks', ile: 'aeronis' },
      { id: 3, nom: 'Le Phare', ile: 'brisants' },
      { id: 4, nom: 'Lieu sans île', ile: null },
      { id: 5, nom: null, ile: 'aeronis' },
    ]
    const index = lieuxParIle(fiches)
    expect(index.get('aeronis').map((l) => l.id)).toEqual([2, 1, 5])
    expect(index.get('brisants').map((l) => l.id)).toEqual([3])
    expect(index.has(null)).toBe(false)
  })
})
