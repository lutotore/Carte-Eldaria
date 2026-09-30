/** Générateur pseudo-aléatoire déterministe : une île garde toujours la même silhouette. */
export function aleatoire(graine) {
  let h = 2166136261
  for (const c of String(graine)) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 10000) / 10000
  }
}

const f = (n) => n.toFixed(1)

/** Contour d'île vu de dessus, lissé par courbes quadratiques. */
export function contour(graine, cx, cy, r, { points = 14, echelle = 1 } = {}) {
  const hasard = aleatoire(graine)
  const sommets = Array.from({ length: points }, (_, i) => {
    const angle = (i / points) * Math.PI * 2
    const k = (0.78 + hasard() * 0.32) * echelle
    return [cx + Math.cos(angle) * r * k * 1.15, cy + Math.sin(angle) * r * k * 0.85]
  })
  const milieu = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const depart = milieu(sommets.at(0), sommets.at(1))
  let d = `M${f(depart[0])} ${f(depart[1])}`
  for (let i = 1; i <= points; i++) {
    const p = sommets.at(i % points)
    const m = milieu(p, sommets.at((i + 1) % points))
    d += ` Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`
  }
  return `${d}Z`
}

/** Dessous rocheux d'une île vue en élévation : un cône irrégulier sous la surface. */
export function dessous(graine, cx, haut, largeur, profondeur) {
  const hasard = aleatoire(`${graine}-dessous`)
  const segments = 9
  let d = `M${f(cx - largeur / 2)} ${f(haut)}`
  for (let i = 1; i < segments; i++) {
    const x = cx - largeur / 2 + (largeur * i) / segments
    const creux = profondeur * (0.3 + 0.7 * Math.sin((Math.PI * i) / segments)) * (0.75 + hasard() * 0.4)
    d += ` L${f(x)} ${f(haut + creux)}`
  }
  return `${d} L${f(cx + largeur / 2)} ${f(haut)} Z`
}
