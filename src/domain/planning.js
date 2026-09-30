// Partagé : l'API l'importe aussi (comme projection.js), pour que front et serveur appliquent les mêmes règles.
/**
 * Règles de la planification des séances : plages horaires, créneau commun, choix de la meilleure date.
 * Les heures sont manipulées en minutes depuis minuit du jour proposé ; une fin après minuit dépasse 1440.
 */
export const MAX_DATES = 10
export const FUSEAU = 'Europe/Paris'

const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/
const JOUR = /^\d{4}-\d{2}-\d{2}$/

const enMinutes = (texte) => {
  const trouve = HEURE.exec(String(texte ?? ''))
  return trouve ? Number(trouve[1]) * 60 + Number(trouve[2]) : null
}

/** « 14:00 » → « 23:30 » donne { debut: 840, fin: 1410 } ; une fin avant le début est le lendemain. */
export function lirePlage(plage) {
  const debut = enMinutes(plage?.debut)
  const fin = enMinutes(plage?.fin)
  if (debut === null || fin === null || debut === fin) return null
  return { debut, fin: fin < debut ? fin + 1440 : fin }
}

/** 1500 → « 01:00 » */
export function enHeure(minutes) {
  const dansLaJournee = ((minutes % 1440) + 1440) % 1440
  const h = String(Math.floor(dansLaJournee / 60)).padStart(2, '0')
  const m = String(dansLaJournee % 60).padStart(2, '0')
  return `${h}:${m}`
}

/** Chevauchement de toutes les plages, ou null s'il n'y en a pas. */
export function creneauCommun(plages) {
  if (plages.length === 0) return null
  const debut = Math.max(...plages.map((p) => p.debut))
  const fin = Math.min(...plages.map((p) => p.fin))
  return fin > debut ? { debut, fin } : null
}

const duree = (creneau) => (creneau ? creneau.fin - creneau.debut : 0)

/**
 * Du meilleur au moins bon : d'abord les dates jouables (un créneau commun existe), puis plus de joueurs
 * disponibles, puis créneau commun plus long, puis date plus proche.
 */
export function classerDates(dates) {
  return [...dates].sort((a, b) => (Number(Boolean(b.creneau)) - Number(Boolean(a.creneau)))
    || (b.disponibles - a.disponibles)
    || (duree(b.creneau) - duree(a.creneau))
    || a.jour.localeCompare(b.jour))
}

/** Date du jour (AAAA-MM-JJ) à l'heure de Paris. */
export function jourAParis(instant) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}

/** Message d'erreur, ou null si le jour est valide et pas encore passé. */
export function erreurJour(jour, aujourdHui) {
  if (typeof jour !== 'string' || !JOUR.test(jour)) return `Date invalide : « ${jour} ». Format attendu : AAAA-MM-JJ.`
  const date = new Date(`${jour}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== jour) return `La date ${jour} n'existe pas.`
  if (jour < aujourdHui) return `La date ${jour} est déjà passée.`
  return null
}
