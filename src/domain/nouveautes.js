/** « Quoi de neuf » : les notifications d'une campagne, présentées comme un fil pour le joueur. */

const ETIQUETTES = {
  revelations: 'Nouvelle information',
  personnage: 'Butin et fiche',
  annonces: 'Message du MJ',
  carte: 'Carte et Gazette',
  seances: 'Séances',
}

export const etiquetteDe = (categorie) => ETIQUETTES[categorie] ?? 'Nouveauté'

/** Ce qui n'a pas encore été vu d'abord ; l'ordre d'arrivée est gardé dans chaque groupe. */
export function regrouper(liste) {
  return { nouvelles: liste.filter((n) => !n.lue), deja: liste.filter((n) => n.lue) }
}
