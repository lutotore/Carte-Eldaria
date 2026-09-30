// Partagé : l'API l'importe aussi, pour que front et serveur appliquent les mêmes règles de révélation.
/**
 * Fiches de la bibliothèque (PNJ pour commencer) et règle de révélation.
 * Une fiche est faite de facettes (nom, portrait, faction, secrets…) ; chacune est révélée
 * au groupe entier, à certains joueurs, ou à personne. Un joueur ne voit que ce qui lui a été révélé.
 */
export const FACETTES_PNJ = ['nom', 'portrait', 'role', 'faction', 'lieu', 'attitude', 'statut', 'description']

/** Libellés affichés, par clé de facette. */
export const LIBELLES_FACETTES = {
  nom: 'Nom', portrait: 'Portrait', role: 'Rôle', faction: 'Faction', lieu: 'Où le trouver', attitude: 'Attitude envers le groupe', statut: 'Statut', description: 'Description', secret: 'Secret',
}

export const ATTITUDES = [
  { cle: 'allie', nom: 'Allié' },
  { cle: 'amical', nom: 'Amical' },
  { cle: 'neutre', nom: 'Neutre' },
  { cle: 'mefiant', nom: 'Méfiant' },
  { cle: 'hostile', nom: 'Hostile' },
]

export const STATUTS = [
  { cle: 'vivant', nom: 'Vivant' },
  { cle: 'mort', nom: 'Mort' },
  { cle: 'disparu', nom: 'Disparu' },
  { cle: 'inconnu', nom: 'Inconnu' },
]

const LONGUEURS = { nom: 80, titre: 80, role: 200, faction: 200, lieu: 200, description: 4000, secret: 4000, portrait: 64 }
const cles = (liste) => liste.map((x) => x.cle)

/** Message d'erreur, ou null si la valeur convient à cette facette. */
export function erreurFacette(cle, valeur) {
  if (typeof valeur !== 'string') return 'Valeur invalide.'
  if (cle === 'attitude') return valeur === '' || cles(ATTITUDES).includes(valeur) ? null : 'Attitude inconnue.'
  if (cle === 'statut') return valeur === '' || cles(STATUTS).includes(valeur) ? null : 'Statut inconnu.'
  if (cle === 'nom' && valeur.trim() === '') return 'Le PNJ doit avoir un nom (au moins pour toi).'
  const max = LONGUEURS[cle]
  if (!max) return 'Facette inconnue.'
  return valeur.length > max ? `Texte trop long (${max} caractères au plus).` : null
}

export const erreurTitreSecret = (titre) => (typeof titre === 'string' && titre.trim() && titre.length <= LONGUEURS.titre
  ? null : `Donne un titre au secret (${LONGUEURS.titre} caractères au plus).`)

const reveleePour = (facette, utilisateurId) => facette.revelations
  .some((r) => r.pourTous || r.utilisateurId === utilisateurId)

/**
 * La fiche telle qu'un joueur a le droit de la voir, ou null s'il n'en connaît rien.
 * Les notes du MJ et les facettes non révélées n'en sortent jamais.
 */
export function vueJoueur(fiche, facettes, utilisateurId) {
  const visibles = facettes.filter((f) => f.valeur !== '' && reveleePour(f, utilisateurId))
  if (visibles.length === 0) return null
  const trouver = (cle) => visibles.find((f) => f.cle === cle)
  return {
    id: fiche.id,
    type: fiche.type,
    nom: trouver('nom')?.valeur ?? null,
    facettes: visibles.filter((f) => f.cle !== 'nom' && f.cle !== 'portrait').map((f) => ({
      id: f.id,
      cle: f.cle,
      titre: f.titre,
      valeur: f.valeur,
      pourMoiSeul: !f.revelations.some((r) => r.pourTous),
    })),
    portrait: trouver('portrait')?.valeur ?? null,
  }
}

/** Résumé pour la liste du MJ : rien de révélé, une partie, ou tout (au groupe). */
export function etatDeRevelation(facettes) {
  const remplies = facettes.filter((f) => f.valeur !== '')
  const auGroupe = remplies.filter((f) => f.revelations.some((r) => r.pourTous))
  if (remplies.length > 0 && auGroupe.length === remplies.length) return 'revele'
  return remplies.some((f) => f.revelations.length > 0) ? 'partiel' : 'cache'
}

const TYPES_NOTE = ['note', 'croyance']
const VISIBILITES = ['privee', 'groupe']
const LONGUEUR_NOTE = 2000

export function erreurNote({ type, visibilite, texte }) {
  if (!TYPES_NOTE.includes(type)) return 'Choisis entre une note et une croyance.'
  if (!VISIBILITES.includes(visibilite)) return 'Choisis si la note est privée ou partagée avec le groupe.'
  if (typeof texte !== 'string' || texte.trim() === '') return 'La note est vide.'
  return texte.length > LONGUEUR_NOTE ? `Note trop longue (${LONGUEUR_NOTE} caractères au plus).` : null
}

/** Texte lisible d'une facette (« hostile » → « Hostile »). */
export function valeurLisible(cle, valeur) {
  const liste = cle === 'attitude' ? ATTITUDES : cle === 'statut' ? STATUTS : null
  return liste ? liste.find((x) => x.cle === valeur)?.nom ?? valeur : valeur
}
