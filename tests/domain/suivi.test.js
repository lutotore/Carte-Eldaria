import { describe, expect, it } from 'vitest'
import { ajusterMarques, ajusterReputation, changerActe, lecturesEnTete, noterCroyance } from '../../src/domain/suivi.js'
import { publierNouvelle } from '../../src/domain/journal.js'
import { unMonde } from './fabrique.js'

describe('croyances', () => {
  it('ajoute un point à la lecture et garde la note au journal', () => {
    const etat = noterCroyance(unMonde(), 'a', 'La fresque')
    expect(etat.croyances.a).toBe(1)
    expect(etat.journal[0].texte).toBe('Croyance Lecture A : La fresque')
  })

  it('donne la ou les lectures en tête', () => {
    expect(lecturesEnTete({ a: 0, b: 0 })).toEqual([])
    expect(lecturesEnTete({ a: 2, b: 1 })).toEqual(['a'])
    expect(lecturesEnTete({ a: 2, b: 2 })).toEqual(['a', 'b'])
  })
})

describe('réputations et Marques', () => {
  it('borne la réputation entre −3 et +3', () => {
    let etat = unMonde()
    for (let i = 0; i < 5; i++) etat = ajusterReputation(etat, 'guilde', 1)
    expect(etat.reputations.guilde).toBe(3)
  })

  it('borne les Marques entre 0 et 5', () => {
    expect(ajusterMarques(unMonde(), 0, -1).pjs[0].marques).toBe(0)
    let etat = unMonde()
    for (let i = 0; i < 7; i++) etat = ajusterMarques(etat, 0, 1)
    expect(etat.pjs[0].marques).toBe(5)
  })
})

describe('acte et nouvelles', () => {
  it("refuse un acte hors de 1 à 5", () => {
    expect(() => changerActe(unMonde(), 6)).toThrow()
    expect(changerActe(unMonde(), 2).acte).toBe(2)
  })

  it('publie une nouvelle datée de la session en cours', () => {
    const etat = publierNouvelle(unMonde(), { titre: '  Chute !  ', texte: 'Détails' })
    expect(etat.nouvelles[0]).toEqual({ t: 'Session 1', titre: 'Chute !', texte: 'Détails' })
  })

  it('refuse une nouvelle sans titre', () => {
    expect(() => publierNouvelle(unMonde(), { titre: ' ' })).toThrow('titre')
  })
})
