import { aleatoire } from './formes.js'

/**
 * Éléments de croquis d'une île vue en élévation : arbres, tours, cristaux.
 * Tout est déterministe (même île = même dessin), calculé à partir de la graine.
 */
export function croquisIle(graine, { cx, haut, largeur, profondeur, r }) {
  const hasard = aleatoire(`${graine}-croquis`)
  const bombe = r * 0.18 // hauteur du dôme de terre au centre
  const hauteurSol = (x) => haut - bombe * Math.max(0, 1 - ((x - cx) / (largeur / 2)) ** 2)

  const nbArbres = 2 + Math.floor(hasard() * 3)
  const arbres = Array.from({ length: nbArbres }, (_, i) => {
    const x = cx - largeur * 0.38 + ((i + 0.5) / nbArbres) * largeur * 0.76 + (hasard() - 0.5) * 6
    const rayon = 3.5 + hasard() * 3
    return { x, y: hauteurSol(x) - rayon + 1, rayon }
  })

  const tours = r >= 26
    ? [-0.12, 0.1].map((k, i) => {
        const x = cx + k * largeur
        const h = 11 + hasard() * 8 + i * 3
        return { x, base: hauteurSol(x) + 1, h }
      })
    : []

  const nbCristaux = 2 + Math.floor(hasard() * 3)
  const cristaux = Array.from({ length: nbCristaux }, (_, i) => {
    const x = cx - largeur * 0.2 + ((i + 0.5) / nbCristaux) * largeur * 0.4
    const y = haut + profondeur * (0.5 + hasard() * 0.2)
    return { x, y, long: 7 + hasard() * 9 }
  })

  const dome = `M${cx - largeur / 2 - 3} ${haut} Q${cx} ${haut - bombe * 2} ${cx + largeur / 2 + 3} ${haut} Z`
  return { dome, arbres, tours, cristaux }
}

/** Bancs de nuages de la mer de brume, légèrement différents à chaque rangée. */
export function nuagesBrume(y, largeur, graine = 'brume') {
  const hasard = aleatoire(graine)
  const nuages = []
  for (let rang = 0; rang < 3; rang++) {
    for (let x = -40; x < largeur + 60; x += 70 + hasard() * 40) {
      nuages.push({ cx: x, cy: y + 6 + rang * 16 + hasard() * 6, rx: 45 + hasard() * 35, ry: 12 + hasard() * 8, rang })
    }
  }
  return nuages
}
