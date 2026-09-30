/** Garde-fou minimal avant d'écraser le monde d'une campagne. */
export function estUnEtatValide(etat) {
  return Boolean(
    etat && typeof etat === 'object' && !Array.isArray(etat)
    && etat.regles && etat.iles && etat.missions && Number.isInteger(etat.horloge),
  )
}
