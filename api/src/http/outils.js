import { ErreurMetier } from '../domaine/erreurs.js'

/** Identifiant numérique dans l'URL ; tout autre valeur donne un 404. */
export function idDe(valeur) {
  const id = Number(valeur)
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErreurMetier('introuvable', 'Élément introuvable.')
  return id
}

/** Limite commune aux formulaires sensibles (connexion, liens). */
export const LIMITE_TENTATIVES = { rateLimit: { max: 10, timeWindow: '15 minutes' } }
