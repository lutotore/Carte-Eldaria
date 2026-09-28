const nombre = new Intl.NumberFormat('fr-FR')

export const formaterAltitude = (alt) => (alt == null ? 'non mesurée' : `${nombre.format(Math.round(alt))} m`)

/** Écart entre les deux derniers relevés (négatif quand l'île descend), ou null. */
export function ecartDernierReleve(ile) {
  const h = ile.historique ?? []
  if (h.length < 2) return null
  const ecart = h.at(-1).alt - h.at(-2).alt
  return ecart === 0 ? null : ecart
}

export const NOMS_STATUT_ILE = { stable: 'Stable', descend: 'Descend', instable: 'Instable', tombee: 'Engloutie' }
export const NOMS_STATUT_MISSION = { cachee: 'Cachée', disponible: 'Ouverte', en_cours: 'En cours', terminee: 'Accomplie' }
export const NOMS_ACTE = ['I', 'II', 'III', 'IV', 'V']
