import { journaliser } from './journal.js'

const borner = (v, min, max) => Math.max(min, Math.min(max, v))

/** Ajoute un indice au Registre des Croyances, en faveur d'une lecture. */
export function noterCroyance(etat, lecture, note) {
  if (!(lecture in etat.croyances)) throw new Error(`Lecture inconnue : ${lecture}`)
  const nom = etat.regles.lectures.find((l) => l.cle === lecture)?.nom ?? lecture
  const croyances = { ...etat.croyances, [lecture]: etat.croyances[lecture] + 1 }
  return journaliser({ ...etat, croyances }, `Croyance ${nom}${note ? ` : ${note}` : ''}`)
}

export function ajusterCroyance(etat, lecture, delta) {
  if (!(lecture in etat.croyances)) throw new Error(`Lecture inconnue : ${lecture}`)
  return { ...etat, croyances: { ...etat.croyances, [lecture]: Math.max(0, etat.croyances[lecture] + delta) } }
}

/** Lecture(s) en tête du registre ; vide tant qu'aucun indice n'est noté. */
export function lecturesEnTete(croyances) {
  const max = Math.max(...Object.values(croyances))
  if (max <= 0) return []
  return Object.keys(croyances).filter((k) => croyances[k] === max)
}

/** Réputation d'une faction, bornée entre −3 et +3. */
export function ajusterReputation(etat, faction, delta) {
  const avant = etat.reputations[faction]
  if (avant === undefined) throw new Error(`Faction inconnue : ${faction}`)
  const apres = borner(avant + delta, -3, 3)
  if (apres === avant) return etat
  const nom = etat.regles.factions.find((f) => f.cle === faction)?.nom ?? faction
  return journaliser({ ...etat, reputations: { ...etat.reputations, [faction]: apres } }, `Réputation ${nom} : ${apres > 0 ? '+' : ''}${apres}`)
}

/** Marques du Rêve d'un personnage, bornées entre 0 et 5. */
export function ajusterMarques(etat, index, delta) {
  const pj = etat.pjs.at(index)
  if (!pj) throw new Error(`Personnage inconnu : ${index}`)
  const marques = borner(pj.marques + delta, 0, 5)
  if (marques === pj.marques) return etat
  const pjs = etat.pjs.map((p, i) => (i === index ? { ...p, marques } : p))
  return journaliser({ ...etat, pjs }, `${pj.nom} : ${marques} Marque${marques > 1 ? 's' : ''} du Rêve`)
}

export function renommerPj(etat, index, nom) {
  const net = String(nom ?? '').trim() || 'Sans nom'
  return { ...etat, pjs: etat.pjs.map((p, i) => (i === index ? { ...p, nom: net } : p)) }
}

export function ajouterPj(etat, nom = 'Nouveau personnage') {
  return { ...etat, pjs: [...etat.pjs, { nom, marques: 0 }] }
}

export function retirerPj(etat, index) {
  return { ...etat, pjs: etat.pjs.filter((_, i) => i !== index) }
}

export function changerActe(etat, acte) {
  const n = Number(acte)
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error("L'acte va de 1 à 5.")
  if (n === etat.acte) return etat
  return journaliser({ ...etat, acte: n }, `Passage à l'acte ${['I', 'II', 'III', 'IV', 'V'].at(n - 1)}`)
}

export function changerSession(etat, session) {
  const net = String(session ?? '').trim()
  if (!net || net === etat.session) return etat
  return { ...etat, session: net }
}
