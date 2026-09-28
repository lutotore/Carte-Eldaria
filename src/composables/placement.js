/**
 * Place des étiquettes sans chevauchement : chaque étiquette part de sa
 * position idéale et, si elle heurte une étiquette déjà posée, se décale
 * d'un cran dans la direction donnée (vers le haut par défaut).
 */
export function placerEtiquettes(etiquettes, { hauteur = 30, direction = -1, essais = 8 } = {}) {
  const posees = []
  const positions = {}
  for (const e of etiquettes) {
    let y = e.y
    for (let i = 0; i < essais; i++) {
      const heurt = posees.find((p) => Math.abs(p.x - e.x) < (p.largeur + e.largeur) / 2 && Math.abs(p.y - y) < hauteur)
      if (!heurt) break
      y = heurt.y + direction * (hauteur + 1)
    }
    posees.push({ x: e.x, y, largeur: e.largeur })
    positions[e.id] = y
  }
  return positions
}

/** Largeur approximative d'un texte, pour anticiper les collisions sans mesurer le DOM. */
export const largeurTexte = (texte, taille = 14, facteur = 0.52) => String(texte).length * taille * facteur
