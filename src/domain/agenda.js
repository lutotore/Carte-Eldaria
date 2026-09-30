/**
 * Mise en agenda d'une séance fixée : lien Google Agenda et fichier .ics.
 * Une séance : { id, jour: 'AAAA-MM-JJ', debut, fin (minutes depuis minuit, heure de Paris), lieu, campagne }.
 */
import { FUSEAU } from './planning.js'

/** Écart (ms) entre l'heure affichée dans le fuseau et l'heure UTC, à cet instant. */
function decalage(instant, fuseau) {
  const morceaux = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: fuseau, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant).map((p) => [p.type, Number(p.value)]))
  const affiche = Date.UTC(morceaux.year, morceaux.month - 1, morceaux.day, morceaux.hour, morceaux.minute, morceaux.second)
  return affiche - instant.getTime()
}

/** Heure « murale » de Paris (jour + minutes) → instant UTC, heure d'été comprise. */
export function versUtc(jour, minutes, fuseau = FUSEAU) {
  const [a, m, j] = jour.split('-').map(Number)
  const mural = Date.UTC(a, m - 1, j) + minutes * 60_000
  const estimation = mural - decalage(new Date(mural), fuseau)
  return new Date(mural - decalage(new Date(estimation), fuseau))
}

/** 2026-10-17T12:00:00Z → 20261017T120000Z */
const formatIcs = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const titre = (seance) => `${seance.campagne} : séance de jeu de rôle`

export function lienGoogleAgenda(seance) {
  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', titre(seance))
  url.searchParams.set('dates', `${formatIcs(versUtc(seance.jour, seance.debut))}/${formatIcs(versUtc(seance.jour, seance.fin))}`)
  if (seance.lieu) url.searchParams.set('location', seance.lieu)
  return url.toString()
}

/** Échappement du texte iCalendar (RFC 5545, §3.3.11). */
const echapper = (texte) => String(texte)
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n')

/** Pliage des lignes à 75 octets (RFC 5545, §3.1), sans couper un caractère UTF-8. */
function plier(ligne) {
  const encodeur = new TextEncoder()
  const morceaux = []
  let courant = ''
  let taille = 0
  for (const caractere of ligne) {
    const octets = encodeur.encode(caractere).length
    // La première ligne a 75 octets ; les suivantes commencent par une espace, donc 74 utiles.
    const limite = morceaux.length === 0 ? 75 : 74
    if (taille + octets > limite) {
      morceaux.push(courant)
      courant = ''
      taille = 0
    }
    courant += caractere
    taille += octets
  }
  morceaux.push(courant)
  return morceaux.join('\r\n ')
}

export function contenuIcs(seance, { origine, maintenant }) {
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Portail Eldaria//Seances//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:seance-${seance.id}@${new URL(origine).hostname}`,
    `DTSTAMP:${formatIcs(maintenant)}`,
    `DTSTART:${formatIcs(versUtc(seance.jour, seance.debut))}`,
    `DTEND:${formatIcs(versUtc(seance.jour, seance.fin))}`,
    `SUMMARY:${echapper(titre(seance))}`,
    ...(seance.lieu ? [`LOCATION:${echapper(seance.lieu)}`] : []),
    `URL:${origine}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lignes.map(plier).join('\r\n')}\r\n`
}

/** 1230 → « 20 h 30 », 840 → « 14 h » */
export function heureLisible(minutes) {
  const dansLaJournee = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(dansLaJournee / 60)
  const m = dansLaJournee % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/** « samedi 17 octobre 2026 » */
export function jourLisible(jour) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${jour}T00:00:00Z`))
}

/** « samedi 17 octobre 2026, de 14 h à 23 h » */
export function decrireSeance({ jour, debut, fin }) {
  const lendemain = fin >= 1440 ? ' (le lendemain)' : ''
  return `${jourLisible(jour)}, de ${heureLisible(debut)} à ${heureLisible(fin)}${lendemain}`
}
