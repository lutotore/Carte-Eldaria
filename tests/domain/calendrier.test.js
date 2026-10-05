import { describe, expect, it } from 'vitest'
import {
  CALENDRIER, DATE_DE_DEPART, depuisDate, erreurEvenement, FETES, formater, grilleDuMois, JOURS_PAR_AN, moisVoisin, occurrencesEntre,
  estJourValide, JOUR_MAX, parJour, prochaineOccurrence, prochains, souffleDe, versDate,
} from '../../src/domain/calendrier.js'

const jourDe = (annee, mois, jour) => depuisDate({ annee, mois, jour })

describe('le calendrier d’Eldaria', () => {
  it('compte 12 mois de 30 jours et 5 Jours Blancs, soit 365 jours', () => {
    expect(CALENDRIER.mois).toHaveLength(12)
    expect(JOURS_PAR_AN).toBe(365)
    expect(CALENDRIER.mois.map((m) => m.nom)).toEqual([
      'Primevent', 'Givrecime', 'Montebrume', 'Pleinebrume', 'Lanterne', 'Larmefonte',
      'Reflux', 'Voilefort', 'Moisson', 'Ciel-Clair', 'Longue-Vue', 'Veillée',
    ])
  })

  it('passe d’un jour absolu à une date et inversement', () => {
    expect(versDate(0)).toEqual({ annee: 0, mois: 0, jour: 1 })
    const jour = jourDe(3207, 10, 3)
    expect(versDate(jour)).toEqual({ annee: 3207, mois: 10, jour: 3 })
    expect(versDate(jour + 1)).toEqual({ annee: 3207, mois: 10, jour: 4 })
    // Après le 30 Veillée viennent les Jours Blancs, puis le 1er Primevent de l'année suivante.
    const finVeillee = jourDe(3207, 11, 30)
    expect(versDate(finVeillee + 1)).toEqual({ annee: 3207, mois: null, jour: 1 })
    expect(versDate(finVeillee + 5)).toEqual({ annee: 3207, mois: null, jour: 5 })
    expect(versDate(finVeillee + 6)).toEqual({ annee: 3208, mois: 0, jour: 1 })
    expect(depuisDate({ annee: 3207, mois: null, jour: 2 })).toBe(finVeillee + 2)
  })

  it('refuse une date impossible', () => {
    expect(depuisDate({ annee: 3207, mois: 12, jour: 1 })).toBeNull()
    expect(depuisDate({ annee: 3207, mois: 0, jour: 31 })).toBeNull()
    expect(depuisDate({ annee: 3207, mois: null, jour: 6 })).toBeNull()
    expect(depuisDate({ annee: -1, mois: 0, jour: 1 })).toBeNull()
    expect(depuisDate({ annee: 3207.5, mois: 0, jour: 1 })).toBeNull()
  })

  it('écrit une date comme dans les journaux de bord', () => {
    expect(formater(jourDe(3207, 2, 12))).toBe('12 Montebrume 3207 AE')
    expect(formater(jourDe(3207, 0, 1))).toBe('1er Primevent 3207 AE')
    expect(formater(depuisDate({ annee: 3207, mois: null, jour: 2 }))).toBe('2e Jour Blanc 3207 AE')
    expect(formater(depuisDate({ annee: 3207, mois: null, jour: 1 }))).toBe('1er Jour Blanc 3207 AE')
  })

  it('donne le Souffle de chaque date', () => {
    expect(souffleDe(jourDe(3207, 0, 1)).nom).toBe('L’Inspir')
    expect(souffleDe(jourDe(3207, 4, 15)).nom).toBe('Le Plein')
    expect(souffleDe(jourDe(3207, 10, 3)).nom).toBe('Le Creux')
    expect(souffleDe(depuisDate({ annee: 3207, mois: null, jour: 3 })).nom).toBe('Les Jours Blancs')
  })

  it('part du 3 Longue-Vue 3207, pendant le recrutement de la Compagnie', () => {
    expect(formater(DATE_DE_DEPART)).toBe('3 Longue-Vue 3207 AE')
  })
})

describe('grilleDuMois', () => {
  it('range un mois en trois décades de dix jours', () => {
    const grille = grilleDuMois(3207, 10)
    expect(grille).toHaveLength(3)
    expect(grille.map((d) => d.length)).toEqual([10, 10, 10])
    expect(grille[0][2]).toEqual({ jour: jourDe(3207, 10, 3), numero: 3 })
  })

  it('les Jours Blancs forment une courte page à part', () => {
    expect(grilleDuMois(3207, null)).toEqual([[1, 2, 3, 4, 5].map((n) => ({ jour: depuisDate({ annee: 3207, mois: null, jour: n }), numero: n }))])
  })
})

describe('occurrencesEntre', () => {
  it('place un événement unique à sa date, sur toute sa durée', () => {
    const debut = jourDe(3207, 10, 1)
    const evenement = { jour: jourDe(3207, 10, 5), duree: 3, annuel: false }
    expect(occurrencesEntre(evenement, debut, debut + 29)).toEqual([jourDe(3207, 10, 5)])
    expect(occurrencesEntre(evenement, jourDe(3207, 10, 6), debut + 29)).toEqual([jourDe(3207, 10, 5)])
    expect(occurrencesEntre(evenement, jourDe(3207, 10, 8), debut + 29)).toEqual([])
  })

  it('répète une fête chaque année, à partir de sa date', () => {
    const nuitDesLanternes = { jour: jourDe(0, 4, 15), duree: 1, annuel: true }
    expect(occurrencesEntre(nuitDesLanternes, jourDe(3207, 0, 1), jourDe(3208, 11, 30))).toEqual([jourDe(3207, 4, 15), jourDe(3208, 4, 15)])
  })
})

describe('erreurEvenement', () => {
  const valide = { titre: 'Nuit des Lanternes', description: '', jour: 100, duree: 1, annuel: false }
  it('accepte un événement complet', () => {
    expect(erreurEvenement(valide)).toBeNull()
  })

  it('borne les dates : au-delà, les calculs ne seraient plus exacts', () => {
    expect(estJourValide(0)).toBe(true)
    expect(estJourValide(JOUR_MAX)).toBe(true)
    expect(estJourValide(JOUR_MAX + 1)).toBe(false)
    expect(estJourValide(1e17)).toBe(false)
    expect(estJourValide(-1)).toBe(false)
    expect(erreurEvenement({ ...valide, jour: 1e17 })).not.toBeNull()
    expect(erreurEvenement({ ...valide, jour: JOUR_MAX, duree: 2 })).not.toBeNull()
    expect(depuisDate({ annee: 1e14, mois: 0, jour: 1 })).toBeNull()
  })

  it('refuse un titre vide, une durée impossible ou un jour invalide', () => {
    expect(erreurEvenement({ ...valide, titre: ' ' })).not.toBeNull()
    expect(erreurEvenement({ ...valide, duree: 0 })).not.toBeNull()
    expect(erreurEvenement({ ...valide, duree: 400 })).not.toBeNull()
    expect(erreurEvenement({ ...valide, jour: -1 })).not.toBeNull()
    expect(erreurEvenement({ ...valide, jour: 1.5 })).not.toBeNull()
    expect(erreurEvenement({ ...valide, description: 'x'.repeat(4001) })).not.toBeNull()
    expect(erreurEvenement({ ...valide, annuel: 'oui' })).not.toBeNull()
  })
})

describe('navigation et fêtes', () => {
  it('passe de Veillée aux Jours Blancs, puis au Primevent suivant, et revient', () => {
    expect(moisVoisin({ annee: 3207, mois: 11 }, 1)).toEqual({ annee: 3207, mois: null })
    expect(moisVoisin({ annee: 3207, mois: null }, 1)).toEqual({ annee: 3208, mois: 0 })
    expect(moisVoisin({ annee: 3208, mois: 0 }, -1)).toEqual({ annee: 3207, mois: null })
    expect(moisVoisin({ annee: 3207, mois: 4 }, -1)).toEqual({ annee: 3207, mois: 3 })
  })

  it('trouve la prochaine fête', () => {
    const lanternes = FETES.find((f) => f.titre === 'Nuit des Lanternes')
    expect(formater(prochaineOccurrence(lanternes, DATE_DE_DEPART))).toBe('15 Lanterne 3208 AE')
    expect(FETES.every((f) => f.annuel && erreurEvenement(f) === null)).toBe(true)
  })
})

describe('parJour et prochains', () => {
  const debut = jourDe(3207, 10, 1)
  const evenements = [
    { id: 1, titre: 'Voyage', jour: jourDe(3207, 10, 29), duree: 4, annuel: false },
    { id: 2, titre: 'Grande Mesure', jour: jourDe(0, 10, 1), duree: 1, annuel: true },
    { id: 3, titre: 'Plus tard', jour: jourDe(3208, 0, 1), duree: 1, annuel: false },
    { id: 4, titre: 'Bien plus tard', jour: jourDe(3210, 0, 1), duree: 1, annuel: false },
    { id: 5, titre: 'Passé', jour: jourDe(3200, 0, 1), duree: 1, annuel: false },
  ]

  it('range les entrées sur chaque jour qu’elles couvrent, dans la période', () => {
    const index = parJour(evenements, debut, debut + 29)
    expect(index.get(debut).map((e) => e.id)).toEqual([2])
    expect(index.get(jourDe(3207, 10, 30)).map((e) => e.id)).toEqual([1])
    expect(index.has(jourDe(3207, 11, 1))).toBe(false)
    expect(index.get(jourDe(3207, 10, 29))[0]).toMatchObject({ id: 1, occurrence: jourDe(3207, 10, 29) })
  })

  it('trouve un événement annuel dont la première fois est dans plusieurs années', () => {
    expect(prochaineOccurrence({ jour: jourDe(3210, 0, 1), duree: 1, annuel: true }, jourDe(3207, 0, 1))).toBe(jourDe(3210, 0, 1))
  })

  it('liste les prochaines entrées à partir d’un jour, dans l’ordre', () => {
    expect(prochains(evenements, jourDe(3207, 10, 3), 10).map((e) => [e.id, formater(e.occurrence)])).toEqual([
      [1, '29 Longue-Vue 3207 AE'], [3, '1er Primevent 3208 AE'], [2, '1er Longue-Vue 3208 AE'], [4, '1er Primevent 3210 AE'],
    ])
  })
})
