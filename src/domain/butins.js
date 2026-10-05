// Partagé : l'API l'importe aussi.
/**
 * Butins de rencontre (des objets et des pièces où les joueurs se servent) et Marques du Rêve.
 */
import { erreurBourse, PIECES } from './personnage.js'

/** Un butin se prépare en secret, s'ouvre aux joueurs, puis se ferme (il disparaît de leur vue). */
export const STATUTS_BUTIN = ['prepare', 'ouvert', 'clos']

const LONGUEURS = { titre: 120, notesMj: 20_000, libelle: 120, description: 1000, don: 4000, prix: 4000 }

const texteTropLong = (valeur, cle) => (typeof valeur !== 'string' || valeur.length > LONGUEURS[cle]
  ? `Texte trop long (${LONGUEURS[cle]} caractères au plus).` : null)
const vide = (valeur) => typeof valeur !== 'string' || !valeur.trim()

export function erreurButin({ titre, notesMj = '', pieces } = {}) {
  if (vide(titre)) return 'Donne un titre au butin (la rencontre).'
  return texteTropLong(titre, 'titre') ?? texteTropLong(notesMj, 'notesMj') ?? erreurBourse(pieces)
}

/** `minimum` vaut 0 pour corriger un objet déjà entièrement pris. */
export function erreurObjetButin({ libelle, quantite, description = '' } = {}, { minimum = 1 } = {}) {
  if (vide(libelle)) return 'Donne un nom à l’objet, tel que les joueurs le verront.'
  if (!Number.isInteger(quantite) || quantite < minimum || quantite > 9999) return `La quantité est un nombre entier entre ${minimum} et 9 999.`
  return texteTropLong(libelle, 'libelle') ?? texteTropLong(description, 'description')
}

/** Message d'erreur, ou null si le joueur peut prendre ces pièces dans ce qui reste. */
export function erreurPrisePieces(reste, demande) {
  const probleme = erreurBourse(demande)
  if (probleme) return probleme
  if (PIECES.every((p) => demande[p.cle] === 0)) return 'Tu ne prends aucune pièce.'
  return PIECES.every((p) => demande[p.cle] <= reste[p.cle]) ? null : 'Il n’en reste pas autant dans le butin.'
}

const combiner = (a, b, signe) => Object.fromEntries(PIECES.map((p) => [p.cle, a[p.cle] + signe * b[p.cle]]))
export const additionner = (a, b) => combiner(a, b, 1)
export const retirer = (a, b) => combiner(a, b, -1)

/** Une Marque du Rêve : son nom, le don qu'elle accorde et le prix qu'elle coûte. */
export function erreurMarque({ titre, don = '', prix = '' } = {}) {
  if (vide(titre)) return 'Donne un nom à la Marque.'
  return texteTropLong(titre, 'titre') ?? texteTropLong(don, 'don') ?? texteTropLong(prix, 'prix')
}
