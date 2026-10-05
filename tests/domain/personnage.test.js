import { describe, expect, it } from 'vitest'
import {
  bonusMaitrise, calculs, COMPETENCES, erreurBourse, erreurChamps, erreurLigne, ficheVierge, modificateur, PIECES, valeurEnPo,
} from '../../src/domain/personnage.js'

describe('fiche de personnage : règles de D&D 5e', () => {
  it('donne le modificateur de chaque valeur de caractéristique', () => {
    expect([1, 8, 9, 10, 11, 12, 15, 20, 30].map(modificateur)).toEqual([-5, -1, -1, 0, 0, 1, 2, 5, 10])
  })

  it('donne le bonus de maîtrise selon le niveau', () => {
    expect([1, 4, 5, 8, 9, 13, 17, 20].map(bonusMaitrise)).toEqual([2, 2, 3, 3, 4, 5, 6, 6])
  })

  it('compte les 18 compétences, chacune liée à sa caractéristique', () => {
    expect(COMPETENCES).toHaveLength(18)
    expect(COMPETENCES.find((c) => c.cle === 'discretion')).toMatchObject({ nom: 'Discrétion', carac: 'dex' })
  })

  it('calcule sauvegardes, compétences, initiative et Perception passive', () => {
    const fiche = {
      ...ficheVierge('Isaure'),
      niveau: 5,
      caracteristiques: { for: 8, dex: 16, con: 12, int: 10, sag: 14, cha: 11 },
      sauvegardes: ['dex', 'int'],
      competences: { perception: 1, discretion: 2 },
    }
    const c = calculs(fiche)
    expect(c.maitrise).toBe(3)
    expect(c.modificateurs).toEqual({ for: -1, dex: 3, con: 1, int: 0, sag: 2, cha: 0 })
    expect(c.sauvegardes).toMatchObject({ dex: 6, int: 3, for: -1 })
    expect(c.competences).toMatchObject({ perception: 5, discretion: 9, athletisme: -1 })
    expect(c.initiative).toBe(3)
    expect(c.perceptionPassive).toBe(15)
  })
})

describe('fiche vierge', () => {
  it('porte le nom choisi et des valeurs de départ sûres', () => {
    const fiche = ficheVierge('Isaure')
    expect(fiche).toMatchObject({ nom: 'Isaure', niveau: 1, xp: 0, inspiration: false, sauvegardes: [], competences: {} })
    expect(Object.values(fiche.caracteristiques)).toEqual([10, 10, 10, 10, 10, 10])
    expect(erreurChamps(fiche)).toBeNull()
  })
})

describe('erreurChamps', () => {
  it('accepte une modification partielle', () => {
    expect(erreurChamps({ classe: 'Roublarde', niveau: 3 })).toBeNull()
    expect(erreurChamps({ competences: { perception: 1, discretion: 2 } })).toBeNull()
    expect(erreurChamps({ jetsMort: { succes: 2, echecs: 0 } })).toBeNull()
  })

  it('refuse un champ inconnu, un nom vide ou un texte trop long', () => {
    expect(erreurChamps({ marques: [] })).toMatch(/inconnu/)
    expect(erreurChamps({ nom: '  ' })).toMatch(/nom/i)
    expect(erreurChamps({ histoire: 'x'.repeat(8001) })).toMatch(/trop long/)
    expect(erreurChamps({})).toMatch(/rien/i)
    expect(erreurChamps(null)).toMatch(/rien/i)
  })

  it('refuse des nombres hors des règles', () => {
    expect(erreurChamps({ niveau: 21 })).not.toBeNull()
    expect(erreurChamps({ niveau: 2.5 })).not.toBeNull()
    expect(erreurChamps({ caracteristiques: { for: 31, dex: 10, con: 10, int: 10, sag: 10, cha: 10 } })).not.toBeNull()
    expect(erreurChamps({ caracteristiques: { for: 10 } })).not.toBeNull()
    expect(erreurChamps({ jetsMort: { succes: 4, echecs: 0 } })).not.toBeNull()
  })

  it('refuse une maîtrise inconnue', () => {
    expect(erreurChamps({ sauvegardes: ['chance'] })).not.toBeNull()
    expect(erreurChamps({ sauvegardes: ['dex', 'dex'] })).not.toBeNull()
    expect(erreurChamps({ competences: { voler: 1 } })).not.toBeNull()
    expect(erreurChamps({ competences: { perception: 3 } })).not.toBeNull()
    expect(erreurChamps({ inspiration: 'oui' })).not.toBeNull()
  })

  it("ne se laisse pas piéger par les clés héritées d'un objet", () => {
    expect(erreurChamps(JSON.parse('{"__proto__": {"nom": "x"}}'))).not.toBeNull()
    expect(erreurChamps({ competences: JSON.parse('{"__proto__": 1}') })).not.toBeNull()
  })
})

describe('bourse', () => {
  it('les cinq pièces, de la plus précieuse à la plus modeste', () => {
    expect(PIECES.map((p) => p.cle)).toEqual(['pp', 'po', 'pe', 'pa', 'pc'])
  })

  it('accepte des quantités entières et positives de chaque pièce', () => {
    expect(erreurBourse({ pp: 0, po: 20, pe: 0, pa: 3, pc: 12 })).toBeNull()
    expect(erreurBourse({ pp: 0, po: -1, pe: 0, pa: 0, pc: 0 })).not.toBeNull()
    expect(erreurBourse({ pp: 0, po: 1.5, pe: 0, pa: 0, pc: 0 })).not.toBeNull()
    expect(erreurBourse({ po: 1 })).not.toBeNull()
  })

  it('donne la valeur totale en pièces d’or', () => {
    expect(valeurEnPo({ pp: 1, po: 2, pe: 1, pa: 3, pc: 5 })).toBeCloseTo(12.85)
  })
})

describe('ligne d’inventaire', () => {
  it('a un libellé, une quantité et des notes facultatives', () => {
    expect(erreurLigne({ libelle: 'Corde de chanvre (15 m)', quantite: 1, notes: '' })).toBeNull()
    expect(erreurLigne({ libelle: '', quantite: 1, notes: '' })).not.toBeNull()
    expect(erreurLigne({ libelle: 'Torche', quantite: 0, notes: '' })).not.toBeNull()
    expect(erreurLigne({ libelle: 'Torche', quantite: 10, notes: 'x'.repeat(1001) })).not.toBeNull()
  })
})
