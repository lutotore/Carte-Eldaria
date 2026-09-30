const JOUR_MS = 24 * 60 * 60 * 1000

export function expirationDans(maintenant, jours) {
  return new Date(maintenant.getTime() + jours * JOUR_MS)
}

/**
 * Un lien à usage unique (invitation, réinitialisation) est :
 * inconnu, déjà utilisé, expiré, ou valide.
 */
export function etatDuLien(lien, maintenant) {
  if (!lien) return 'inconnu'
  if (lien.utiliseLe) return 'utilise'
  if (new Date(lien.expireLe) <= maintenant) return 'expire'
  return 'valide'
}
