// Partagé : l'API l'importe aussi, pour que le pupitre et le serveur visent les mêmes facettes.
import { libelleFacette, SECTIONS_TITREES } from './fiches.js'

/**
 * Scènes préparées pour le pupitre de séance. Une scène regroupe ce qu'on révèle d'un geste :
 * des éléments, chacun une fiche de la bibliothèque et les facettes à révéler.
 * Une facette se désigne par sa clé (« nom », « description », « secret »)
 * ou, pour une facette titrée, par « clé:titre » (« secret:Faiblesse »). Rien de précisé : tout ce qui est rempli.
 */

const LONGUEUR_TITRE = 120
const LONGUEUR_SUITE = 2000
const NOMS_MAX_DANS_UNE_PHRASE = 3

/** Découpe « secret:Faiblesse » en { cle, titre }. */
function lireSelecteur(selecteur) {
  const separateur = selecteur.indexOf(':')
  if (separateur === -1) return { cle: selecteur, titre: null }
  return { cle: selecteur.slice(0, separateur), titre: selecteur.slice(separateur + 1).trim() }
}

const correspond = (facette, { cle, titre }) => facette.cle === cle && (titre === null || facette.titre === titre)

/** Les facettes remplies qu'un élément révèle, dans l'ordre de la fiche. */
export function facettesVisees(facettes, selecteurs = []) {
  const remplies = facettes.filter((f) => f.valeur !== '')
  if (!selecteurs?.length) return remplies
  const lus = selecteurs.map(lireSelecteur)
  return remplies.filter((f) => lus.some((s) => correspond(f, s)))
}

/** Ce que les joueurs en savent : rien, une partie, tout (au groupe) ; « vide » s'il n'y a rien à révéler. */
export function etatDesFacettes(facettes) {
  if (facettes.length === 0) return 'vide'
  if (facettes.every((f) => f.revelations.some((r) => r.pourTous))) return 'revele'
  return facettes.some((f) => f.revelations.length > 0) ? 'partiel' : 'cache'
}

/** Ce qu'un élément révèle, en clair pour le MJ : « Nom, Description, Faiblesse ». */
export function resumeSelecteurs(type, selecteurs = []) {
  if (!selecteurs?.length) return 'Tout ce qui est rempli'
  return selecteurs.map(lireSelecteur)
    .map(({ cle, titre }) => titre || (SECTIONS_TITREES[cle] ?? libelleFacette(type, cle)))
    .join(', ')
}

/** La notification d'un joueur qui découvre une ou plusieurs fiches d'un coup. */
export function phraseDecouvertes(noms) {
  if (noms.length === 1) return `Nouvelle information : ${noms[0]}.`
  const cites = noms.length > NOMS_MAX_DANS_UNE_PHRASE + 1
    ? [...noms.slice(0, NOMS_MAX_DANS_UNE_PHRASE), `${noms.length - NOMS_MAX_DANS_UNE_PHRASE} autres`]
    : noms
  return `Nouvelles informations : ${cites.slice(0, -1).join(', ')} et ${cites.at(-1)}.`
}

const texteBorne = (valeur, max) => typeof valeur === 'string' && valeur.length <= max

function elementValide(element) {
  if (!element || !Number.isInteger(element.ficheId)) return false
  const { facettes = [] } = element
  return Array.isArray(facettes) && facettes.every((s) => typeof s === 'string' && s.trim() !== '' && s.length <= 200)
}

/** Message d'erreur lisible, ou null si la scène est bien formée. */
export function erreurScene({ titre, sousTitre = '', elements, suite = '' } = {}) {
  if (!texteBorne(titre, LONGUEUR_TITRE) || !titre.trim()) return `Une scène a besoin d'un titre (${LONGUEUR_TITRE} caractères au plus).`
  if (!texteBorne(sousTitre, LONGUEUR_TITRE)) return `Sous-titre trop long (${LONGUEUR_TITRE} caractères au plus).`
  if (!Array.isArray(elements) || !elements.every(elementValide)) return 'Un élément de la scène est mal formé : une fiche et ses facettes.'
  if (!texteBorne(suite, LONGUEUR_SUITE)) return `Le texte de suite est trop long (${LONGUEUR_SUITE} caractères au plus).`
  return null
}
