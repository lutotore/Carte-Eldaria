/** Révélation côté interface du MJ : lire qui voit une information, et la basculer d'un clic. */

/** « personne », « groupe » ou « certains ». */
export function modeDe(revelations) {
  if (revelations.some((r) => r.pourTous)) return 'groupe'
  return revelations.length ? 'certains' : 'personne'
}

/** Le clic sur l'œil : une information visible du groupe se cache ; sinon elle est révélée au groupe. */
export function basculer(revelations) {
  return { pourTous: modeDe(revelations) !== 'groupe', joueurs: [] }
}

export const FILTRES_REVELATION = [
  { cle: '', nom: 'Tout' },
  { cle: 'cache', nom: 'Encore cachés' },
  { cle: 'partiel', nom: 'En partie' },
  { cle: 'revele', nom: 'Révélés' },
]

export const garderSelon = (fiches, filtre) => (filtre ? fiches.filter((f) => f.revelation === filtre) : fiches)
