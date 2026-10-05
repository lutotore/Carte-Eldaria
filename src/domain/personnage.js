// Partagé : l'API l'importe aussi, pour que le site et le serveur valident une fiche de la même façon.
/**
 * Fiche de personnage (D&D 5e, règles de 2014) : ce que le joueur écrit, et ce qui s'en déduit.
 * Les valeurs calculées (modificateurs, bonus, Perception passive) ne sont jamais stockées.
 */

export const CARACTERISTIQUES = [
  { cle: 'for', nom: 'Force' },
  { cle: 'dex', nom: 'Dextérité' },
  { cle: 'con', nom: 'Constitution' },
  { cle: 'int', nom: 'Intelligence' },
  { cle: 'sag', nom: 'Sagesse' },
  { cle: 'cha', nom: 'Charisme' },
]

export const COMPETENCES = [
  { cle: 'acrobaties', nom: 'Acrobaties', carac: 'dex' },
  { cle: 'arcanes', nom: 'Arcanes', carac: 'int' },
  { cle: 'athletisme', nom: 'Athlétisme', carac: 'for' },
  { cle: 'discretion', nom: 'Discrétion', carac: 'dex' },
  { cle: 'dressage', nom: 'Dressage', carac: 'sag' },
  { cle: 'escamotage', nom: 'Escamotage', carac: 'dex' },
  { cle: 'histoire', nom: 'Histoire', carac: 'int' },
  { cle: 'intimidation', nom: 'Intimidation', carac: 'cha' },
  { cle: 'investigation', nom: 'Investigation', carac: 'int' },
  { cle: 'medecine', nom: 'Médecine', carac: 'sag' },
  { cle: 'nature', nom: 'Nature', carac: 'int' },
  { cle: 'perception', nom: 'Perception', carac: 'sag' },
  { cle: 'perspicacite', nom: 'Perspicacité', carac: 'sag' },
  { cle: 'persuasion', nom: 'Persuasion', carac: 'cha' },
  { cle: 'religion', nom: 'Religion', carac: 'int' },
  { cle: 'representation', nom: 'Représentation', carac: 'cha' },
  { cle: 'survie', nom: 'Survie', carac: 'sag' },
  { cle: 'tromperie', nom: 'Tromperie', carac: 'cha' },
]

/** Maîtrise d'une compétence : aucune, maîtrise, ou expertise (bonus doublé). */
export const NIVEAUX_MAITRISE = [0, 1, 2]

export const PIECES = [
  { cle: 'pp', nom: 'Platine', valeurEnPo: 10 },
  { cle: 'po', nom: 'Or', valeurEnPo: 1 },
  { cle: 'pe', nom: 'Électrum', valeurEnPo: 0.5 },
  { cle: 'pa', nom: 'Argent', valeurEnPo: 0.1 },
  { cle: 'pc', nom: 'Cuivre', valeurEnPo: 0.01 },
]

const CLES_CARACS = CARACTERISTIQUES.map((c) => c.cle)
const CLES_COMPETENCES = COMPETENCES.map((c) => c.cle)
const MAX_PIECES = 1_000_000_000

const estEntier = (valeur, min, max) => Number.isInteger(valeur) && valeur >= min && valeur <= max
const estObjet = (valeur) => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
/** Les clés propres d'un objet uniquement : `__proto__` et compagnie ne passent pas pour des champs. */
const memesCles = (objet, cles) => {
  const propres = Object.keys(objet)
  return propres.length === cles.length && cles.every((c) => Object.hasOwn(objet, c))
}

const texte = (max, { requis = false } = {}) => (v) => {
  if (typeof v !== 'string') return 'Texte attendu.'
  if (requis && !v.trim()) return 'Donne un nom au personnage.'
  return v.length > max ? `Texte trop long (${max} caractères au plus).` : null
}
const entier = (min, max) => (v) => (estEntier(v, min, max) ? null : `Nombre entier attendu, entre ${min} et ${max}.`)

/** Chaque champ de la fiche et sa règle. */
const CHAMPS = {
  nom: texte(80, { requis: true }),
  classe: texte(120),
  niveau: entier(1, 20),
  espece: texte(120),
  historique: texte(120),
  alignement: texte(60),
  xp: entier(0, 10_000_000),
  caracteristiques: (v) => (estObjet(v) && memesCles(v, CLES_CARACS) && CLES_CARACS.every((c) => estEntier(v[c], 1, 30))
    ? null : 'Chaque caractéristique est un nombre entier entre 1 et 30.'),
  ca: entier(0, 50),
  pvMax: entier(0, 9999),
  pvActuels: entier(-9999, 9999),
  pvTemporaires: entier(0, 9999),
  vitesse: texte(60),
  desDeVie: texte(60),
  sauvegardes: (v) => (Array.isArray(v) && v.every((c) => CLES_CARACS.includes(c)) && new Set(v).size === v.length
    ? null : 'Sauvegardes maîtrisées : une liste de caractéristiques.'),
  competences: (v) => (estObjet(v) && Object.keys(v).every((c) => CLES_COMPETENCES.includes(c) && NIVEAUX_MAITRISE.includes(v[c]))
    && !Object.hasOwn(v, '__proto__') ? null : 'Compétence ou niveau de maîtrise inconnu.'),
  jetsMort: (v) => (estObjet(v) && memesCles(v, ['succes', 'echecs']) && estEntier(v.succes, 0, 3) && estEntier(v.echecs, 0, 3)
    ? null : 'Jets contre la mort : de 0 à 3 succès et échecs.'),
  inspiration: (v) => (typeof v === 'boolean' ? null : 'Inspiration : oui ou non.'),
  attaques: texte(4000),
  langues: texte(2000),
  maitrises: texte(2000),
  capacites: texte(8000),
  sorts: texte(8000),
  apparence: texte(2000),
  histoire: texte(8000),
  notes: texte(8000),
}

export const CHAMPS_FICHE = Object.keys(CHAMPS)

/** Une fiche toute neuve : le reste se remplit à la création du personnage. */
export function ficheVierge(nom) {
  return {
    nom,
    classe: '', niveau: 1, espece: '', historique: '', alignement: '', xp: 0,
    caracteristiques: Object.fromEntries(CLES_CARACS.map((c) => [c, 10])),
    ca: 10, pvMax: 0, pvActuels: 0, pvTemporaires: 0, vitesse: '9 m', desDeVie: '',
    sauvegardes: [], competences: {}, jetsMort: { succes: 0, echecs: 0 }, inspiration: false,
    attaques: '', langues: '', maitrises: '', capacites: '', sorts: '', apparence: '', histoire: '', notes: '',
  }
}

/** Message d'erreur, ou null si la modification (partielle) de la fiche est valable. */
export function erreurChamps(champs) {
  if (!estObjet(champs) || Object.keys(champs).length === 0) return 'Il n’y a rien à enregistrer.'
  for (const cle of Object.keys(champs)) {
    if (!Object.hasOwn(CHAMPS, cle)) return `Champ inconnu : ${cle}.`
    const probleme = CHAMPS[cle](champs[cle])
    if (probleme) return probleme
  }
  return null
}

export const modificateur = (score) => Math.floor((score - 10) / 2)
export const bonusMaitrise = (niveau) => 2 + Math.floor((niveau - 1) / 4)

/** Ce qui se déduit de la fiche : modificateurs, sauvegardes, compétences, initiative, Perception passive. */
export function calculs(fiche) {
  const maitrise = bonusMaitrise(fiche.niveau)
  const modificateurs = Object.fromEntries(CLES_CARACS.map((c) => [c, modificateur(fiche.caracteristiques[c])]))
  const sauvegardes = Object.fromEntries(CLES_CARACS.map((c) => [c, modificateurs[c] + (fiche.sauvegardes.includes(c) ? maitrise : 0)]))
  const competences = Object.fromEntries(COMPETENCES.map(({ cle, carac }) => [cle, modificateurs[carac] + (fiche.competences[cle] ?? 0) * maitrise]))
  return { maitrise, modificateurs, sauvegardes, competences, initiative: modificateurs.dex, perceptionPassive: 10 + competences.perception }
}

/** Message d'erreur, ou null si les cinq pièces sont des quantités entières positives. */
export function erreurBourse(bourse) {
  const cles = PIECES.map((p) => p.cle)
  if (!estObjet(bourse) || !memesCles(bourse, cles)) return 'Indique les cinq pièces (pp, po, pe, pa, pc).'
  return cles.every((c) => estEntier(bourse[c], 0, MAX_PIECES)) ? null : 'Chaque quantité de pièces est un nombre entier positif.'
}

export const valeurEnPo = (bourse) => PIECES.reduce((total, p) => total + (bourse[p.cle] ?? 0) * p.valeurEnPo, 0)

export const LONGUEURS_LIGNE = { libelle: 120, notes: 1000 }

/** Une ligne d'inventaire : un libellé, une quantité, des notes. */
export function erreurLigne({ libelle, quantite, notes = '' } = {}) {
  if (typeof libelle !== 'string' || !libelle.trim()) return 'Donne un nom à l’objet.'
  if (libelle.length > LONGUEURS_LIGNE.libelle) return `Nom trop long (${LONGUEURS_LIGNE.libelle} caractères au plus).`
  if (!estEntier(quantite, 1, 9999)) return 'La quantité est un nombre entier entre 1 et 9 999.'
  if (typeof notes !== 'string' || notes.length > LONGUEURS_LIGNE.notes) return `Notes trop longues (${LONGUEURS_LIGNE.notes} caractères au plus).`
  return null
}
