/**
 * Catalogue des règles : les éléments du SRD, plus ceux des livres que le serveur charge à part.
 * Toutes les recherches passent par des Map : un id comme « __proto__ » ne trouve jamais rien.
 */

const TYPES = ['classe', 'sous-classe', 'don', 'liste', 'option-classe']

/** Clés de `regles.choix` qui ne sont pas des listes. */
const CLES_RESERVEES = ['dons', 'expertise', 'competences', 'options-classe']

const parNom = (a, b) => a.nom.localeCompare(b.nom, 'fr')

/** Une liste enrichie par un autre livre : ses options s'ajoutent à celles de la liste d'origine. */
function enrichir(liste, ajout) {
  if (!liste) throw new Error(`Liste inconnue à enrichir : ${ajout.id}.`)
  const doublon = ajout.options.find((o) => liste.options.some((x) => x.id === o.id))
  if (doublon) throw new Error(`Option en double dans la liste ${ajout.id} : ${doublon.id}.`)
  return { ...liste, options: [...liste.options, ...ajout.options] }
}

export function creerCatalogue(elements) {
  const index = new Map(TYPES.map((t) => [t, new Map()]))
  const ajouts = elements.filter((e) => e?.type === 'liste' && e.ajout)
  for (const element of elements.filter((e) => !ajouts.includes(e))) {
    const table = index.get(element.type)
    if (!table) throw new Error(`Type d’élément inconnu : ${element.type}.`)
    if (element.type === 'liste' && CLES_RESERVEES.includes(element.id)) throw new Error(`Id de liste réservé : ${element.id}.`)
    const cle = element.type === 'sous-classe' ? `${element.classe}/${element.id}` : element.id
    if (table.has(cle)) throw new Error(`Élément en double : ${element.type} ${element.id}.`)
    table.set(cle, element)
  }
  const listes = index.get('liste')
  for (const ajout of ajouts) listes.set(ajout.id, enrichir(listes.get(ajout.id), ajout))
  const tous = (type) => [...index.get(type).values()]
  const un = (type, cle) => index.get(type).get(cle) ?? null

  return {
    classes: () => tous('classe').sort(parNom),
    classe: (id) => un('classe', id),
    sousClassesDe: (classeId) => tous('sous-classe').filter((s) => s.classe === classeId),
    sousClasse: (classeId, id) => un('sous-classe', `${classeId}/${id}`),
    dons: () => tous('don').sort(parNom),
    don: (id) => un('don', id),
    liste: (id) => un('liste', id),
    optionsDeClasse: (classeId) => tous('option-classe').filter((o) => o.classe === classeId),
    listesDuGroupe: (groupe) => tous('liste').filter((l) => l.groupe === groupe),
  }
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
const CARACS = ['for', 'dex', 'con', 'int', 'sag', 'cha']
const INCANTATIONS = [null, undefined, 'complet', 'demi', 'tiers', 'pacte', 'artificier']

/** Les listes d'options que nomment les choix d'un élément (classe, sous-classe, don). */
function listesNommees(element) {
  const tables = [...Object.values(element.choix ?? {}), ...(element.multiclasse?.choix ?? [])]
  const choix = Array.isArray(element.choix) ? element.choix : tables.flat()
  return choix.filter((c) => c.liste).map((c) => c.liste)
}

function erreurElement(element, catalogue) {
  if (typeof element !== 'object' || element === null) return 'Élément invalide.'
  const nom = `${element.type} ${element.id}`
  if (typeof element.id !== 'string' || !ID.test(element.id)) return `${nom} : id invalide (minuscules, chiffres et tirets).`
  if (typeof element.nom !== 'string' || !element.nom.trim()) return `${nom} : nom manquant.`
  if (typeof element.source !== 'string' || !element.source.trim()) return `${nom} : source manquante.`
  const rattachee = element.type === 'sous-classe' || element.type === 'option-classe'
  if (rattachee && !catalogue.classe(element.classe)) return `${nom} : classe inconnue (${element.classe}).`
  if (element.type === 'option-classe' && !(Number.isInteger(element.niveau) && element.niveau >= 1 && element.niveau <= 20)) return `${nom} : niveau invalide.`
  if (element.type === 'classe' && ![6, 8, 10, 12].includes(element.de)) return `${nom} : dé de vie invalide.`
  if (!INCANTATIONS.includes(element.incantation)) return `${nom} : incantation inconnue (${element.incantation}).`
  const parmi = element.amelioration?.parmi ?? []
  if (!parmi.every((c) => CARACS.includes(c))) return `${nom} : caractéristique inconnue dans l’amélioration.`
  const nommees = [...listesNommees(element), ...(element.remplace?.listes ?? [])]
  const manquante = nommees.find((liste) => !catalogue.liste(liste))
  return manquante ? `${nom} : liste inconnue (${manquante}).` : null
}

/** Message d'erreur, ou null si ces éléments forment un catalogue cohérent. Sert à vérifier un fichier avant de l'importer. */
export function erreurCatalogue(elements) {
  if (!Array.isArray(elements)) return 'Les éléments doivent former une liste.'
  let catalogue
  try {
    catalogue = creerCatalogue(elements)
  } catch (e) {
    return e.message
  }
  for (const element of elements) {
    const erreur = erreurElement(element, catalogue)
    if (erreur) return erreur
  }
  return null
}
