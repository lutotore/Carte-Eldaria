// Partagé : l'API l'importe aussi.
/**
 * Le calendrier d'Eldaria. Les années se comptent depuis le Grand Exil (AE).
 * Une année : douze mois de trente jours, en trois décades, puis les cinq Jours Blancs.
 * Les saisons sont les quatre Souffles de la brume, qui monte et redescend chaque année.
 *
 * Toutes les dates sont manipulées comme un « jour absolu » : le nombre de jours écoulés
 * depuis le 1er Primevent de l'an 0. C'est ce nombre que la base enregistre.
 * Pour changer le calendrier (noms, découpage), il suffit de modifier CALENDRIER.
 */

const SOUFFLES = {
  inspir: { cle: 'inspir', nom: 'L’Inspir', description: 'La brume monte.' },
  plein: { cle: 'plein', nom: 'Le Plein', description: 'La brume est au plus haut.' },
  expir: { cle: 'expir', nom: 'L’Expir', description: 'La brume redescend.' },
  creux: { cle: 'creux', nom: 'Le Creux', description: 'La brume est au plus bas.' },
  blancs: { cle: 'blancs', nom: 'Les Jours Blancs', description: 'Les nuits sans rêve, entre deux années.' },
}

export const CALENDRIER = {
  ere: 'AE',
  joursParMois: 30,
  joursParDecade: 10,
  mois: [
    { nom: 'Primevent', souffle: 'inspir' },
    { nom: 'Givrecime', souffle: 'inspir' },
    { nom: 'Montebrume', souffle: 'inspir' },
    { nom: 'Pleinebrume', souffle: 'plein' },
    { nom: 'Lanterne', souffle: 'plein' },
    { nom: 'Larmefonte', souffle: 'plein' },
    { nom: 'Reflux', souffle: 'expir' },
    { nom: 'Voilefort', souffle: 'expir' },
    { nom: 'Moisson', souffle: 'expir' },
    { nom: 'Ciel-Clair', souffle: 'creux' },
    { nom: 'Longue-Vue', souffle: 'creux' },
    { nom: 'Veillée', souffle: 'creux' },
  ],
  /** Jours hors des mois, à la fin de l'année. */
  intercalaires: { nom: 'Jour Blanc', pluriel: 'Jours Blancs', jours: 5 },
}

const JOURS_DANS_LES_MOIS = CALENDRIER.mois.length * CALENDRIER.joursParMois
export const JOURS_PAR_AN = JOURS_DANS_LES_MOIS + CALENDRIER.intercalaires.jours
const estEntier = (n) => Number.isInteger(n)
/** Dernière année permise : bien au-delà de toute campagne, et loin des limites où les calculs perdraient en exactitude. */
export const ANNEE_MAX = 99_999
export const JOUR_MAX = (ANNEE_MAX + 1) * JOURS_PAR_AN - 1
export const estJourValide = (jour) => estEntier(jour) && jour >= 0 && jour <= JOUR_MAX

/** { annee, mois, jour } : `mois` vaut null pendant les Jours Blancs ; `jour` commence à 1. */
export function versDate(jourAbsolu) {
  const annee = Math.floor(jourAbsolu / JOURS_PAR_AN)
  const dansAnnee = jourAbsolu - annee * JOURS_PAR_AN
  if (dansAnnee >= JOURS_DANS_LES_MOIS) return { annee, mois: null, jour: dansAnnee - JOURS_DANS_LES_MOIS + 1 }
  return { annee, mois: Math.floor(dansAnnee / CALENDRIER.joursParMois), jour: (dansAnnee % CALENDRIER.joursParMois) + 1 }
}

/** Le jour absolu d'une date, ou null si elle n'existe pas. */
export function depuisDate({ annee, mois, jour }) {
  if (!estEntier(annee) || annee < 0 || annee > ANNEE_MAX || !estEntier(jour) || jour < 1) return null
  if (mois === null) {
    return jour <= CALENDRIER.intercalaires.jours ? annee * JOURS_PAR_AN + JOURS_DANS_LES_MOIS + jour - 1 : null
  }
  if (!estEntier(mois) || mois < 0 || mois >= CALENDRIER.mois.length || jour > CALENDRIER.joursParMois) return null
  return annee * JOURS_PAR_AN + mois * CALENDRIER.joursParMois + jour - 1
}


/** « 12 Montebrume 3207 AE », « 1er Primevent 3207 AE », « 2e Jour Blanc 3207 AE ». */
export function formater(jourAbsolu, { avecAnnee = true } = {}) {
  const { annee, mois, jour } = versDate(jourAbsolu)
  const fin = avecAnnee ? ` ${annee} ${CALENDRIER.ere}` : ''
  if (mois === null) return `${jour === 1 ? '1er' : `${jour}e`} ${CALENDRIER.intercalaires.nom}${fin}`
  return `${jour === 1 ? '1er' : jour} ${CALENDRIER.mois[mois].nom}${fin}`
}

export function souffleDe(jourAbsolu) {
  const { mois } = versDate(jourAbsolu)
  return SOUFFLES[mois === null ? 'blancs' : CALENDRIER.mois[mois].souffle]
}

/** Nom de la page du calendrier : un mois, ou les Jours Blancs. */
export const nomDuMois = (mois) => (mois === null ? CALENDRIER.intercalaires.pluriel : CALENDRIER.mois[mois].nom)

/** Les jours d'un mois rangés par décade ; les Jours Blancs forment une seule rangée. */
export function grilleDuMois(annee, mois) {
  const nombre = mois === null ? CALENDRIER.intercalaires.jours : CALENDRIER.joursParMois
  const jours = Array.from({ length: nombre }, (_, i) => ({ jour: depuisDate({ annee, mois, jour: i + 1 }), numero: i + 1 }))
  if (mois === null) return [jours]
  const decades = []
  for (let i = 0; i < jours.length; i += CALENDRIER.joursParDecade) decades.push(jours.slice(i, i + CALENDRIER.joursParDecade))
  return decades
}

/** Page suivante ou précédente : Veillée → Jours Blancs → Primevent de l'année suivante. */
export function moisVoisin({ annee, mois }, sens) {
  const pages = [...CALENDRIER.mois.map((_, i) => i), null]
  const index = pages.indexOf(mois) + sens
  if (index < 0) return { annee: annee - 1, mois: null }
  if (index >= pages.length) return { annee: annee + 1, mois: 0 }
  return { annee, mois: pages[index] }
}

/**
 * Les jours de début d'un événement qui touchent la période [debut, fin].
 * Un événement annuel revient chaque année à la même date, à partir de sa première fois.
 */
export function occurrencesEntre({ jour, duree = 1, annuel = false }, debut, fin) {
  const touche = (j) => j <= fin && j + duree - 1 >= debut
  if (!annuel) return touche(jour) ? [jour] : []
  const premiere = Math.max(0, Math.floor((debut - duree + 1 - jour) / JOURS_PAR_AN))
  const resultat = []
  for (let n = premiere; jour + n * JOURS_PAR_AN <= fin; n += 1) {
    const j = jour + n * JOURS_PAR_AN
    if (touche(j)) resultat.push(j)
  }
  return resultat
}

/** Prochaine occurrence d'un événement à partir d'un jour (lui compris), ou null. */
export function prochaineOccurrence(evenement, aPartirDe) {
  if (evenement.jour >= aPartirDe) return evenement.jour
  if (!evenement.annuel) return null
  return occurrencesEntre({ ...evenement, duree: 1 }, aPartirDe, aPartirDe + JOURS_PAR_AN)[0] ?? null
}

/** Les entrées par jour couvert dans [debut, fin] ; chaque entrée porte la date de son occurrence. */
export function parJour(evenements, debut, fin) {
  const index = new Map()
  for (const evenement of evenements) {
    for (const occurrence of occurrencesEntre(evenement, debut, fin)) {
      for (let j = Math.max(occurrence, debut); j <= Math.min(occurrence + evenement.duree - 1, fin); j += 1) {
        if (!index.has(j)) index.set(j, [])
        index.get(j).push({ ...evenement, occurrence })
      }
    }
  }
  return index
}

/** Les `nombre` prochaines entrées qui commencent à partir d'un jour, de la plus proche à la plus lointaine. */
export function prochains(evenements, aPartirDe, nombre) {
  return evenements
    .map((e) => ({ ...e, occurrence: prochaineOccurrence(e, aPartirDe) }))
    .filter((e) => e.occurrence !== null)
    .sort((a, b) => a.occurrence - b.occurrence)
    .slice(0, nombre)
}

const LONGUEURS = { titre: 120, description: 4000 }
export const DUREE_MAX = JOURS_PAR_AN

/** Message d'erreur, ou null si l'événement est valable. */
export function erreurEvenement({ titre, description = '', jour, duree = 1, annuel = false } = {}) {
  if (typeof titre !== 'string' || !titre.trim()) return 'Donne un titre à l’événement.'
  if (titre.length > LONGUEURS.titre) return `Titre trop long (${LONGUEURS.titre} caractères au plus).`
  if (typeof description !== 'string' || description.length > LONGUEURS.description) return `Description trop longue (${LONGUEURS.description} caractères au plus).`
  if (!estJourValide(jour)) return 'Date invalide.'
  if (!estEntier(duree) || duree < 1 || duree > DUREE_MAX) return `La durée va de 1 à ${DUREE_MAX} jours.`
  if (jour + duree - 1 > JOUR_MAX) return 'Date invalide.'
  return typeof annuel === 'boolean' ? null : 'Indique si l’événement revient chaque année.'
}

/** Le 3 Longue-Vue 3207 : juste après la Grande Mesure, pendant le recrutement de la Compagnie de l'Horizon. */
export const DATE_DE_DEPART = depuisDate({ annee: 3207, mois: 10, jour: 3 })

/** Les fêtes connues de tout le ciel, posées sur le calendrier d'une nouvelle campagne. */
export const FETES = [
  { titre: 'Jour de l’Envol', date: { mois: 0, jour: 1 }, description: 'Le Nouvel An, anniversaire du Grand Exil Céleste.' },
  { titre: 'Nuit des Lanternes', date: { mois: 4, jour: 15 }, description: 'On lâche des lanternes dans la brume pour les disparus : l’expédition Varenne, la Légion de Fer, et tous les autres.' },
  { titre: 'Deuil de Vandrel', date: { mois: 7, jour: 9 }, description: 'Anniversaire de la disparition de la Légion de Fer, en 3011. Vandrel porte le noir.' },
  { titre: 'Fête des Moulins', date: { mois: 8, jour: 20 }, description: 'Les moissons de Havrebrise : farine, bière et concours de moulins.' },
  { titre: 'La Grande Mesure', date: { mois: 10, jour: 1 }, description: 'La Compagnie de l’Horizon publie ses relevés de l’année et ouvre son recrutement.' },
  { titre: 'Les Jours Blancs', date: { mois: null, jour: 1 }, duree: 5, description: 'Cinq jours hors des mois. On dit que personne n’y rêve ; on veille, on se tient chaud.' },
].map(({ date, duree = 1, ...fete }) => ({ ...fete, jour: depuisDate({ annee: 0, ...date }), duree, annuel: true }))
