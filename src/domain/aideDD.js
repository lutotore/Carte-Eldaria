// Partagé : le site s'en sert pour l'aperçu avant import ; l'API peut l'importer aussi.
/**
 * Import d'un personnage exporté par le créateur de personnages d'aide-dd.org (fichier XML).
 * Le fichier ne contient que les choix du joueur (valeurs de base, augmentations, codes) :
 * on en déduit une fiche du portail. Ce qu'on ne sait pas décoder (CA, équipement) n'est pas
 * deviné : on le signale dans les avertissements.
 */
import { CARACTERISTIQUES, COMPETENCES, modificateur } from './personnage.js'

/** Ordre des caractéristiques dans le fichier (str…cha), et index des augmentations (aug_carac). */
const CARACS_XML = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const CLES_CARACS = CARACTERISTIQUES.map((c) => c.cle)

/** Classes (règles de 2014) : dé de vie et jets de sauvegarde maîtrisés. */
const CLASSES = {
  artificier: { de: 8, sauvegardes: ['con', 'int'] },
  barbare: { de: 12, sauvegardes: ['for', 'con'] },
  barde: { de: 8, sauvegardes: ['dex', 'cha'] },
  clerc: { de: 8, sauvegardes: ['sag', 'cha'] },
  druide: { de: 8, sauvegardes: ['int', 'sag'] },
  ensorceleur: { de: 6, sauvegardes: ['con', 'cha'] },
  guerrier: { de: 10, sauvegardes: ['for', 'con'] },
  magicien: { de: 6, sauvegardes: ['int', 'sag'] },
  moine: { de: 8, sauvegardes: ['for', 'dex'] },
  occultiste: { de: 8, sauvegardes: ['sag', 'cha'] },
  paladin: { de: 10, sauvegardes: ['sag', 'cha'] },
  rodeur: { de: 10, sauvegardes: ['for', 'dex'] },
  roublard: { de: 8, sauvegardes: ['dex', 'int'] },
}

/**
 * Bonus fixes des espèces (règles de 2014). Les choix libres (humain variante, demi-elfe…)
 * passent par les augmentations du fichier, pas par cette table.
 */
const ESPECES = {
  humain: { bonus: { for: 1, dex: 1, con: 1, int: 1, sag: 1, cha: 1 } },
  'nain des collines': { bonus: { con: 2, sag: 1 }, pvParNiveau: 1 },
  'nain des montagnes': { bonus: { con: 2, for: 2 } },
  'haut-elfe': { bonus: { dex: 2, int: 1 } },
  'elfe des bois': { bonus: { dex: 2, sag: 1 } },
  'elfe noir': { bonus: { dex: 2, cha: 1 } },
  drow: { bonus: { dex: 2, cha: 1 } },
  'halfelin pied-leger': { bonus: { dex: 2, cha: 1 } },
  'halfelin robuste': { bonus: { dex: 2, con: 1 } },
  drakeide: { bonus: { for: 2, cha: 1 } },
  'gnome des forets': { bonus: { int: 2, dex: 1 } },
  'gnome des roches': { bonus: { int: 2, con: 1 } },
  'demi-elfe': { bonus: { cha: 2 } },
  'demi-orc': { bonus: { for: 2, con: 1 } },
  tieffelin: { bonus: { cha: 2, int: 1 } },
}

/** Ordre des alignements dans le créateur d'aide-dd (supposé : à vérifier sur un deuxième fichier). */
const ALIGNEMENTS = ['Loyal bon', 'Neutre bon', 'Chaotique bon', 'Loyal neutre', 'Neutre', 'Chaotique neutre', 'Loyal mauvais', 'Neutre mauvais', 'Chaotique mauvais']

const DONS_PV = { robuste: 2 }

const normaliser = (texte) => String(texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const entites = (texte) => texte
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&')
const entier = (texte, defaut = 0) => {
  const n = Number.parseInt(texte, 10)
  return Number.isNaN(n) ? defaut : n
}
const majuscule = (texte) => (texte ? texte[0].toUpperCase() + texte.slice(1) : texte)

/**
 * Le contenu brut du personnage : balises simples en texte, `lvl` par niveau,
 * et les listes à attribut `id` (skillsProf, toolsProf, languages) par identifiant.
 */
export function lireXmlAideDD(texte) {
  const personnage = /<builder[\s>][\s\S]*?<character>([\s\S]*?)<\/character>/.exec(String(texte ?? ''))
  if (!personnage) throw new Error('Ce fichier n’est pas un export de personnage aide-dd.')
  const corps = personnage[1]
  const lu = { lvl: {} }
  for (const [, numero, contenu] of corps.matchAll(/<lvl lvl="(\d+)">([\s\S]*?)<\/lvl>/g)) {
    lu.lvl[numero] = Object.fromEntries([...contenu.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)].map(([, b, v]) => [b, entites(v.trim())]))
  }
  const sansNiveaux = corps.replace(/<lvl lvl="\d+">[\s\S]*?<\/lvl>/g, '')
  for (const [, balise, id, valeur] of sansNiveaux.matchAll(/<(\w+)(?: id="(\d+)")?>([\s\S]*?)<\/\1>/g)) {
    if (id === undefined) lu[balise] = entites(valeur.trim())
    else (lu[balise] ??= {})[id] = entites(valeur.trim())
  }
  return lu
}

/** Les niveaux 1 à `niveau` du fichier, dans l'ordre. */
const niveauxJusqua = (lu, niveau) => Array.from({ length: niveau }, (_, i) => lu.lvl[String(i + 1)] ?? {})

function caracteristiquesDe(lu, niveaux, espece) {
  const caracs = Object.fromEntries(CLES_CARACS.map((cle, i) => [cle, entier(lu[CARACS_XML[i]], 10)]))
  for (const [cle, bonus] of Object.entries(espece?.bonus ?? {})) caracs[cle] += bonus
  for (const n of niveaux) {
    for (const index of [n.aug_carac0, n.aug_carac1, n.aug_carac2].map((v) => entier(v, -1))) {
      if (index >= 0 && index < CLES_CARACS.length) caracs[CLES_CARACS[index]] += 1
    }
  }
  for (const cle of CLES_CARACS) caracs[cle] = Math.min(30, Math.max(1, caracs[cle]))
  return caracs
}

function pvMaxDe(niveaux, classe, espece, modCon, dons) {
  const auxDes = niveaux.reduce((total, n, i) => total + entier(n.hp_brut, i === 0 && classe ? classe.de : 0), 0)
  const parNiveau = modCon + (espece?.pvParNiveau ?? 0) + dons.reduce((t, d) => t + (DONS_PV[normaliser(d)] ?? 0), 0)
  return Math.max(0, auxDes + parNiveau * niveaux.length)
}

const listeDe = (objet) => Object.values(objet ?? {}).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)

/**
 * La fiche du portail tirée du fichier : `champs` (à enregistrer tels quels) et `avertissements`
 * (ce que le joueur doit vérifier ou compléter à la main).
 */
export function ficheDepuisAideDD(texte) {
  const lu = lireXmlAideDD(texte)
  const nom = (lu.name ?? '').trim()
  if (!nom) throw new Error('Le personnage du fichier n’a pas de nom.')
  const avertissements = []
  const niveau = Math.min(20, Math.max(1, entier(lu.level, 1)))
  const niveaux = niveauxJusqua(lu, niveau)
  const nomClasse = (lu.class ?? '').trim()
  const classe = CLASSES[normaliser(nomClasse)]
  if (nomClasse && !classe) avertissements.push(`Classe « ${nomClasse} » inconnue : sauvegardes, dé de vie et PV à vérifier.`)

  const nomEspece = (lu.race ?? '').trim()
  const cleEspece = normaliser(nomEspece).replace(/\s*\(.*\)$/, '')
  const varianteHumaine = /\(don\)/i.test(nomEspece)
  const espece = varianteHumaine ? null : ESPECES[cleEspece]
  if (espece) avertissements.push(`Bonus de l’espèce « ${nomEspece} » ajoutés aux caractéristiques : vérifie qu’ils ne sont pas comptés deux fois.`)
  else if (nomEspece && !varianteHumaine) avertissements.push(`Espèce « ${nomEspece} » inconnue : ajoute ses bonus de caractéristiques à la main.`)

  const caracteristiques = caracteristiquesDe(lu, niveaux, espece)
  const dons = niveaux.flatMap((n) => [n.feat].filter((d) => d && d !== '-1'))
  const pvMax = pvMaxDe(niveaux, classe, espece, modificateur(caracteristiques.con), dons)

  const competences = {}
  for (const index of listeDe(lu.skillsProf).map((v) => entier(v, -1))) {
    if (COMPETENCES[index]) competences[COMPETENCES[index].cle] = 1
  }
  const outils = listeDe(lu.toolsProf)
  const langues = listeDe(lu.languages)
  const alignement = ALIGNEMENTS[entier(lu.alignment, -1)]
  if (alignement) avertissements.push(`Alignement lu comme « ${alignement} » : vérifie-le.`)
  avertissements.push('La CA n’est pas importée (l’armure est codée dans le fichier) : saisis-la à la main.')
  avertissements.push('L’équipement et la bourse ne sont pas importés : ton inventaire et ta bourse du portail restent tels quels.')

  const apparence = [
    lu.age && `${lu.age} ans`, lu.height, lu.weight,
    lu.eyes && `yeux ${lu.eyes}`, lu.skin && `peau ${lu.skin}`, lu.hair && `cheveux ${lu.hair}`,
  ].filter(Boolean).join(' · ')
  const histoire = [
    lu.backstory,
    lu.traits && `Traits : ${lu.traits}`, lu.ideals && `Idéaux : ${lu.ideals}`,
    lu.bonds && `Liens : ${lu.bonds}`, lu.flaws && `Défauts : ${lu.flaws}`,
  ].filter(Boolean).join('\n\n')
  const capacites = [...dons.map((d) => `Don : ${d}`), lu.features].filter(Boolean).join('\n')

  const champs = {
    nom,
    classe: nomClasse,
    niveau,
    espece: nomEspece,
    historique: (lu.background ?? '').trim(),
    xp: Math.max(0, entier(lu.xp, 0)),
    caracteristiques,
    pvMax,
    pvActuels: pvMax,
    competences,
    ...(alignement ? { alignement } : {}),
    ...(classe ? { sauvegardes: classe.sauvegardes, desDeVie: `${niveau}d${classe.de}` } : {}),
    ...(langues.length ? { langues: majuscule(langues.join(', ')) } : {}),
    ...(outils.length ? { maitrises: `Outils : ${outils.join(', ')}` } : {}),
    ...(capacites ? { capacites } : {}),
    ...(apparence ? { apparence } : {}),
    ...(histoire ? { histoire } : {}),
  }
  return { champs, avertissements }
}

const LIBELLES = {
  nom: 'Nom', classe: 'Classe', niveau: 'Niveau', espece: 'Espèce', historique: 'Historique', alignement: 'Alignement', xp: 'XP',
  caracteristiques: 'Caractéristiques', pvMax: 'PV max', pvActuels: 'PV actuels', sauvegardes: 'Sauvegardes maîtrisées',
  desDeVie: 'Dés de vie', competences: 'Compétences maîtrisées', langues: 'Langues', maitrises: 'Maîtrises',
  capacites: 'Capacités', apparence: 'Apparence', histoire: 'Histoire',
}
const ABREGES = { for: 'FOR', dex: 'DEX', con: 'CON', int: 'INT', sag: 'SAG', cha: 'CHA' }

function lisible(cle, valeur) {
  if (cle === 'caracteristiques') return CLES_CARACS.map((c) => `${ABREGES[c]} ${valeur[c]}`).join(' · ')
  if (cle === 'sauvegardes') return valeur.map((c) => ABREGES[c]).join(', ')
  if (cle === 'competences') {
    return COMPETENCES.filter((c) => valeur[c.cle]).map((c) => (valeur[c.cle] === 2 ? `${c.nom} (expertise)` : c.nom)).join(', ')
  }
  return String(valeur ?? '')
}

/** L'aperçu de l'import : les seuls champs qui changent, avant et après, en texte lisible. */
export function differencesImport(fiche, champs) {
  return Object.entries(champs)
    .map(([cle, valeur]) => ({ cle, libelle: LIBELLES[cle] ?? cle, avant: lisible(cle, fiche[cle]), apres: lisible(cle, valeur) }))
    .filter((d) => d.avant !== d.apres)
}
