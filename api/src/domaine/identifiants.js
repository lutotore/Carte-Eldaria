export const LONGUEUR_MIN_MOT_DE_PASSE = 12
const LONGUEUR_MAX_MOT_DE_PASSE = 256
const FORME_IDENTIFIANT = /^[A-Za-z0-9._-]{3,32}$/

/** Renvoie le message d'erreur à afficher, ou null si l'identifiant convient. */
export function erreurIdentifiant(identifiant) {
  if (typeof identifiant !== 'string' || !FORME_IDENTIFIANT.test(identifiant)) {
    return "L'identifiant doit faire 3 à 32 caractères : lettres sans accent, chiffres, point, tiret ou tiret bas."
  }
  return null
}

export function erreurMotDePasse(motDePasse) {
  if (typeof motDePasse !== 'string') return 'Mot de passe manquant.'
  const longueur = [...motDePasse].length
  if (longueur < LONGUEUR_MIN_MOT_DE_PASSE) {
    return `Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères. Une courte phrase est plus facile à retenir.`
  }
  if (longueur > LONGUEUR_MAX_MOT_DE_PASSE) return `Le mot de passe ne peut pas dépasser ${LONGUEUR_MAX_MOT_DE_PASSE} caractères.`
  return null
}
