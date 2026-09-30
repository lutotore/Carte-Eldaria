import { recalculerIles } from './iles.js'
import { alerter, journaliser } from './journal.js'

/**
 * Fait avancer ou reculer l'Horloge d'Éveil.
 * Journalise, signale les seuils franchis pour la première fois,
 * puis recalcule les îles (altitudes, brume, chutes).
 */
export function changerHorloge(etat, delta, libelle) {
  const { max } = etat.regles.horloge
  const avant = etat.horloge
  const apres = Math.max(0, Math.min(max, avant + delta))
  if (apres === avant) return { etat, change: false }

  let suite = journaliser({ ...etat, horloge: apres }, libelle || (delta > 0 ? 'Horloge avancée' : 'Horloge reculée'), apres - avant)

  const dejaVus = new Set(suite.seuilsVus ?? [])
  for (const seuil of suite.regles.seuils) {
    if (avant < seuil.s && apres >= seuil.s && !dejaVus.has(seuil.s)) {
      dejaVus.add(seuil.s)
      suite = journaliser(suite, `Seuil ${seuil.s} franchi : ${seuil.titre}`)
      suite = alerter(suite, { titre: `Seuil ${seuil.s} : ${seuil.titre}`, mj: seuil.mj, nouvelle: seuil.nouvelle ?? null })
    }
  }
  suite = { ...suite, seuilsVus: [...dejaVus].sort((a, b) => a - b) }

  return { etat: recalculerIles(suite).etat, change: true }
}

/** Applique un des événements prévus par les règles (Fin d'acte, expédition…). */
export function appliquerEvenement(etat, index) {
  const evenement = etat.regles.evenements.at(index)
  if (!evenement) throw new Error(`Événement inconnu : ${index}`)
  return changerHorloge(etat, evenement.delta, evenement.libelle)
}
