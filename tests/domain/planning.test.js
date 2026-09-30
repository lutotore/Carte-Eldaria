import { describe, expect, it } from 'vitest'
import {
  classerDates, creneauCommun, erreurJour, jourAParis, lirePlage, MAX_DATES,
} from '../../src/domain/planning.js'

describe('plage horaire', () => {
  it('lit une plage dans la journée, en minutes depuis minuit', () => {
    expect(lirePlage({ debut: '14:00', fin: '23:30' })).toEqual({ debut: 840, fin: 1410 })
  })

  it('accepte une plage qui passe minuit (la fin est le lendemain)', () => {
    expect(lirePlage({ debut: '20:00', fin: '01:00' })).toEqual({ debut: 1200, fin: 1500 })
  })

  it.each([
    [{ debut: '14h', fin: '18:00' }],
    [{ debut: '25:00', fin: '18:00' }],
    [{ debut: '14:00', fin: '14:00' }],
    [{ debut: '14:00' }],
    [null],
  ])('refuse %j', (plage) => {
    expect(lirePlage(plage)).toBeNull()
  })
})

describe('créneau commun', () => {
  it('garde le chevauchement de toutes les plages', () => {
    expect(creneauCommun([{ debut: 840, fin: 1410 }, { debut: 900, fin: 1500 }, { debut: 780, fin: 1320 }]))
      .toEqual({ debut: 900, fin: 1320 })
  })

  it("n'existe pas si deux plages ne se touchent pas", () => {
    expect(creneauCommun([{ debut: 600, fin: 720 }, { debut: 840, fin: 1000 }])).toBeNull()
  })

  it("n'existe pas sans aucune plage", () => {
    expect(creneauCommun([])).toBeNull()
  })
})

describe('classement des dates proposées', () => {
  const date = (id, jour, disponibles, creneau) => ({ id, jour, disponibles, creneau })

  it('met en tête la date où le plus de joueurs sont disponibles', () => {
    const classees = classerDates([
      date(1, '2026-10-10', 2, { debut: 840, fin: 1380 }),
      date(2, '2026-10-17', 4, { debut: 840, fin: 1080 }),
      date(3, '2026-10-24', 3, { debut: 600, fin: 1400 }),
    ])
    expect(classees.map((d) => d.id)).toEqual([2, 3, 1])
  })

  it('préfère une date jouable (créneau commun) à une date avec plus de monde mais sans horaire commun', () => {
    const classees = classerDates([
      date(1, '2026-10-10', 3, null),
      date(2, '2026-10-17', 2, { debut: 840, fin: 1080 }),
    ])
    expect(classees.map((d) => d.id)).toEqual([2, 1])
  })

  it('départage par la durée du créneau commun, puis par la date la plus proche', () => {
    const classees = classerDates([
      date(1, '2026-10-24', 3, { debut: 840, fin: 1380 }),
      date(2, '2026-10-17', 3, { debut: 840, fin: 1080 }),
      date(3, '2026-10-10', 3, { debut: 840, fin: 1380 }),
    ])
    expect(classees.map((d) => d.id)).toEqual([3, 1, 2])
  })
})

describe('jours', () => {
  it("donne la date du jour à Paris, même quand il est déjà demain en UTC… ou pas encore", () => {
    expect(jourAParis(new Date('2026-10-05T22:30:00Z'))).toBe('2026-10-06') // 00:30 à Paris (été)
    expect(jourAParis(new Date('2026-12-05T22:30:00Z'))).toBe('2026-12-05') // 23:30 à Paris (hiver)
  })

  it('refuse un jour mal écrit, inexistant ou déjà passé', () => {
    const aujourdHui = '2026-10-05'
    expect(erreurJour('2026-10-12', aujourdHui)).toBeNull()
    expect(erreurJour('2026-10-05', aujourdHui)).toBeNull()
    expect(erreurJour('12/10/2026', aujourdHui)).not.toBeNull()
    expect(erreurJour('2026-02-30', aujourdHui)).not.toBeNull()
    expect(erreurJour('2026-10-04', aujourdHui)).not.toBeNull()
  })

  it('limite le nombre de dates d’un sondage', () => {
    expect(MAX_DATES).toBe(10)
  })
})
