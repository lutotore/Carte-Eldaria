/** Emplacements de sorts (règles de 2014), à partir des classes d'une fiche rattachée aux règles. */

/** Lanceur complet : emplacements par niveau de sort, pour chaque niveau de lanceur. */
const TABLE = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

/** Magie de pacte de l'occultiste : [nombre d'emplacements, niveau] par niveau d'occultiste. */
const PACTE = [null, [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5]]

const DIVISEURS = { complet: 1, demi: 2, tiers: 3 }

/** Seul, un demi-lanceur arrondit au supérieur (dès son premier niveau de sorts) ; en multiclasse, à l'inférieur. */
function niveauDeLanceur(lanceurs) {
  if (lanceurs.length === 1) {
    const [{ niveau, diviseur }] = lanceurs
    return niveau < diviseur ? 0 : Math.ceil(niveau / diviseur)
  }
  return lanceurs.reduce((total, { niveau, diviseur }) => total + Math.floor(niveau / diviseur), 0)
}

export function emplacements(regles, catalogue) {
  const lanceurs = []
  let pacte = null
  for (const { classe, niveau, sousClasse } of regles.classes) {
    // Certaines sous-classes lancent des sorts quand leur classe n'en lance pas (Chevalier occulte, Arnaqueur arcanique).
    const incantation = catalogue.classe(classe)?.incantation ?? (sousClasse ? catalogue.sousClasse(classe, sousClasse)?.incantation : null)
    if (incantation === 'pacte') {
      const [nombre, niveauSort] = PACTE[niveau]
      pacte = { nombre, niveau: niveauSort }
    } else if (DIVISEURS[incantation]) {
      lanceurs.push({ niveau, diviseur: DIVISEURS[incantation] })
    }
  }
  return { sorts: [...TABLE[niveauDeLanceur(lanceurs)]], pacte }
}
