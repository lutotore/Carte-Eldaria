export const TAILLE_JOURNAL = 120

/** Ajoute une entrée en tête du journal, en gardant les plus récentes. */
export function journaliser(etat, texte, delta = 0) {
  const entree = { t: etat.session, texte, d: delta }
  return { ...etat, journal: [entree, ...(etat.journal ?? [])].slice(0, TAILLE_JOURNAL) }
}

/** Ajoute une alerte pour le MJ (seuil franchi, île tombée…). */
export function alerter(etat, alerte) {
  return { ...etat, alertes: [...(etat.alertes ?? []), alerte] }
}

export function retirerAlerte(etat, index) {
  return { ...etat, alertes: (etat.alertes ?? []).filter((_, i) => i !== index) }
}

/** Publie une nouvelle (visible des joueurs), la plus récente en tête. */
export function publierNouvelle(etat, { titre, texte = '' }) {
  const titreNet = String(titre ?? '').trim()
  if (!titreNet) throw new Error('Une nouvelle doit avoir un titre.')
  const nouvelle = { t: etat.session, titre: titreNet, texte: String(texte).trim() }
  return journaliser({ ...etat, nouvelles: [nouvelle, ...(etat.nouvelles ?? [])] }, `Nouvelle publiée : ${titreNet}`)
}

export function retirerNouvelle(etat, index) {
  return { ...etat, nouvelles: (etat.nouvelles ?? []).filter((_, i) => i !== index) }
}
