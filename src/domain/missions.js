import { changerHorloge } from './horloge.js'
import { journaliser } from './journal.js'

export const STATUTS_MISSION = ['cachee', 'disponible', 'en_cours', 'terminee']

/**
 * Change le statut d'une mission.
 * Terminer une expédition pour la première fois coûte +1 à l'Horloge.
 */
export function changerStatutMission(etat, id, statut) {
  const mission = etat.missions[id]
  if (!mission) throw new Error(`Mission inconnue : ${id}`)
  if (!STATUTS_MISSION.includes(statut)) throw new Error(`Statut inconnu : ${statut}`)
  if (mission.statut === statut) return etat

  const coute = statut === 'terminee' && mission.type === 'expedition' && !mission.horlogeAppliquee
  const modifiee = { ...mission, statut, horlogeAppliquee: mission.horlogeAppliquee || coute }
  let suite = journaliser({ ...etat, missions: { ...etat.missions, [id]: modifiee } }, `Mission « ${mission.titre} » : ${statut}`)
  if (coute) suite = changerHorloge(suite, 1, `Expédition terminée : ${mission.titre}`).etat
  return suite
}
