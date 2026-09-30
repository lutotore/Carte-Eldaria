import { describe, expect, it } from 'vitest'
import { contenuIcs, decrireSeance, lienGoogleAgenda, versUtc } from '../../src/domain/agenda.js'

const seance = { id: 7, jour: '2026-10-17', debut: 840, fin: 1380, lieu: 'Chez Tom', campagne: 'Eldaria' }

describe('heure de Paris vers UTC', () => {
  it("tient compte de l'heure d'été et d'hiver", () => {
    expect(versUtc('2026-10-17', 840).toISOString()).toBe('2026-10-17T12:00:00.000Z') // UTC+2
    expect(versUtc('2026-11-14', 840).toISOString()).toBe('2026-11-14T13:00:00.000Z') // UTC+1
  })

  it('gère une fin après minuit, le jour du changement d’heure compris', () => {
    expect(versUtc('2026-10-24', 1500).toISOString()).toBe('2026-10-24T23:00:00.000Z') // 1 h le 25, encore en été
  })
})

describe('Google Agenda', () => {
  it('ouvre un événement pré-rempli, horaires en UTC', () => {
    const url = new URL(lienGoogleAgenda(seance))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Eldaria : séance de jeu de rôle')
    expect(url.searchParams.get('dates')).toBe('20261017T120000Z/20261017T210000Z')
    expect(url.searchParams.get('location')).toBe('Chez Tom')
  })

  it('omet le lieu quand il n’y en a pas', () => {
    expect(new URL(lienGoogleAgenda({ ...seance, lieu: '' })).searchParams.has('location')).toBe(false)
  })
})

describe('fichier .ics', () => {
  const ics = contenuIcs(seance, { origine: 'https://eldaria.exemple.fr', maintenant: new Date('2026-10-05T08:00:00Z') })

  it('respecte le format iCalendar (lignes CRLF, horaires UTC, identifiant stable)', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('\r\nDTSTART:20261017T120000Z\r\n')
    expect(ics).toContain('\r\nDTEND:20261017T210000Z\r\n')
    expect(ics).toContain('\r\nUID:seance-7@eldaria.exemple.fr\r\n')
    expect(ics).toContain('\r\nDTSTAMP:20261005T080000Z\r\n')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })

  it('échappe les caractères spéciaux du texte', () => {
    const special = contenuIcs({ ...seance, lieu: 'Chez Tom, 2e étage; porte B' }, { origine: 'https://x.fr', maintenant: new Date() })
    expect(special).toContain(String.raw`LOCATION:Chez Tom\, 2e étage\; porte B`)
  })
})

describe('lignes longues du fichier .ics', () => {
  it('plie les lignes à 75 octets sans couper un caractère accentué', () => {
    const long = contenuIcs({ ...seance, lieu: 'Salle des fêtes de la Compagnie de l’Horizon, étage des cartographes, près du grand escalier' },
      { origine: 'https://eldaria.exemple.fr', maintenant: new Date('2026-10-05T08:00:00Z') })
    const lignes = long.split('\r\n')
    for (const ligne of lignes) expect(new TextEncoder().encode(ligne).length).toBeLessThanOrEqual(75)
    const deplie = long.replace(/\r\n /g, '')
    expect(deplie).toContain('LOCATION:Salle des fêtes de la Compagnie de l’Horizon\\, étage des cartographes\\, près du grand escalier')
  })
})

describe('description lisible', () => {
  it('écrit la date et les heures à la française', () => {
    expect(decrireSeance(seance)).toBe('samedi 17 octobre 2026, de 14 h à 23 h')
    expect(decrireSeance({ ...seance, debut: 1230, fin: 1530 })).toBe('samedi 17 octobre 2026, de 20 h 30 à 1 h 30 (le lendemain)')
    expect(decrireSeance({ ...seance, debut: 1200, fin: 1440 })).toBe('samedi 17 octobre 2026, de 20 h à 0 h (le lendemain)')
  })
})
