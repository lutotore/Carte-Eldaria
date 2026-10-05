// Partagé : l'API l'importe aussi, pour que front et serveur appliquent les mêmes règles de révélation.
/**
 * Fiches de la bibliothèque (PNJ pour commencer) et règle de révélation.
 * Une fiche est faite de facettes (nom, portrait, faction, secrets…) ; chacune est révélée
 * au groupe entier, à certains joueurs, ou à personne. Un joueur ne voit que ce qui lui a été révélé.
 */
export const FACETTES_PNJ = ['nom', 'portrait', 'role', 'faction', 'lieu', 'attitude', 'statut', 'description']

/** Facettes fixes de chaque type de fiche, dans l'ordre d'affichage. */
export const FACETTES_PAR_TYPE = {
  pnj: FACETTES_PNJ,
  creature: ['nom', 'portrait', 'nature', 'description', 'habitat', 'ca', 'pv', 'vitesse', 'caracteristiques', 'sauvegardes', 'competences', 'defenses', 'sens', 'langues'],
  lieu: ['nom', 'portrait', 'description', 'ambiance', 'acces'],
  document: ['nom', 'fichier', 'description', 'texte'],
  objet: ['nom', 'portrait', 'apparence', 'nature'],
}

/** Facettes titrées qu'on peut ajouter autant de fois qu'on veut (un secret, une capacité, une action…). */
export const TITREES_PAR_TYPE = {
  pnj: ['secret'],
  creature: ['capacite', 'action', 'reaction', 'secret'],
  lieu: ['secret'],
  document: [],
  objet: ['propriete', 'secret'],
}

/** Statistiques d'une créature que les joueurs peuvent estimer en attendant la vraie valeur. */
export const ESTIMABLES = ['nature', 'ca', 'pv', 'vitesse', 'caracteristiques', 'sauvegardes', 'competences', 'defenses', 'sens', 'langues']

/** Libellés affichés, par clé de facette. */
export const LIBELLES_FACETTES = {
  nom: 'Nom', portrait: 'Portrait', role: 'Rôle', faction: 'Faction', lieu: 'Où le trouver', attitude: 'Attitude envers le groupe', statut: 'Statut', description: 'Description', secret: 'Secret',
  nature: 'Type et taille', habitat: 'Habitat', ca: "Classe d'armure", pv: 'Points de vie', vitesse: 'Vitesse', caracteristiques: 'Caractéristiques',
  sauvegardes: 'Jets de sauvegarde', competences: 'Compétences', defenses: 'Résistances et immunités', sens: 'Sens', langues: 'Langues',
  capacite: 'Capacité', action: 'Action', reaction: 'Réaction',
  ambiance: 'Ambiance', acces: 'Accès', fichier: 'Document (image ou PDF)', texte: 'Texte', apparence: 'Apparence', propriete: 'Propriété',
}

/** Libellé d'une facette, qui peut dépendre du type de fiche (le portrait d'un lieu est une illustration…). */
export function libelleFacette(type, cle) {
  if (cle === 'portrait' && type !== 'pnj') return 'Illustration'
  if (cle === 'nature' && type === 'objet') return 'Type et rareté'
  return LIBELLES_FACETTES[cle] ?? cle
}

/** Titre de section, au pluriel, pour les facettes titrées. */
export const SECTIONS_TITREES = { secret: 'Secrets', capacite: 'Capacités', action: 'Actions', reaction: 'Réactions', propriete: 'Propriétés' }

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

const LONGUEURS = {
  nom: 80, titre: 80, role: 200, faction: 200, lieu: 200, description: 4000, secret: 4000, portrait: 64,
  nature: 120, habitat: 200, ca: 120, pv: 120, vitesse: 120, caracteristiques: 300, sauvegardes: 300, competences: 300, defenses: 300, sens: 300, langues: 300,
  capacite: 4000, action: 4000, reaction: 4000,
  ambiance: 1000, acces: 1000, fichier: 64, texte: 20000, apparence: 1000, propriete: 4000,
}
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

/** Longueur maximale d'une facette, pour les champs de saisie. */
export const longueurMax = (cle) => LONGUEURS[cle] ?? 200

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
    facettes: visibles.filter((f) => !['nom', 'portrait', 'fichier'].includes(f.cle)).map((f) => ({
      id: f.id,
      cle: f.cle,
      titre: f.titre,
      valeur: f.valeur,
      pourMoiSeul: !f.revelations.some((r) => r.pourTous),
    })),
    portrait: trouver('portrait')?.valeur ?? null,
    ...(fiche.type === 'document' ? {
      fichier: trouver('fichier')?.valeur ?? null,
      // Le destinataire d'un document peut le montrer au groupe : utile tant qu'une partie n'est connue que de lui.
      aPartager: visibles.some((f) => !f.revelations.some((r) => r.pourTous)),
    } : {}),
    ...(fiche.type === 'lieu' ? { ile: fiche.ile ?? null } : {}),
  }
}

/**
 * Un joueur a-t-il appris quelque chose entre deux vues d'une fiche (voir vueJoueur) ?
 * Une facette de plus, un nom, un portrait ou le fichier d'un document, nouveaux ou changés.
 */
export function aDecouvert(avant, apres) {
  if (!apres) return false
  if (!avant) return true
  const change = (cle) => Boolean(apres[cle]) && apres[cle] !== avant[cle]
  return apres.facettes.length > avant.facettes.length || change('nom') || change('portrait') || change('fichier')
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

/**
 * Pour chaque statistique estimable d'une créature : la vraie valeur si elle a été révélée à ce joueur,
 * sinon l'estimation que le groupe a notée (ou rien). La vraie valeur « corrige » l'estimation.
 */
export function grilleEstimations(facettes, estimations, utilisateurId) {
  return ESTIMABLES.map((cle) => {
    const facette = facettes.find((f) => f.cle === cle)
    const revelee = facette && facette.valeur !== '' && reveleePour(facette, utilisateurId)
    const pourMoiSeul = Boolean(revelee && !facette.revelations.some((r) => r.pourTous))
    return { cle, valeur: revelee ? facette.valeur : null, estimation: estimations[cle] ?? null, ...(pourMoiSeul ? { pourMoiSeul } : {}) }
  })
}
