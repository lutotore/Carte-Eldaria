/**
 * Catalogue des règles : les éléments du SRD, plus ceux des livres que le serveur charge à part.
 * Toutes les recherches passent par des Map : un id comme « __proto__ » ne trouve jamais rien.
 */

const TYPES = ['classe', 'sous-classe', 'don', 'liste']

/** Clés de `regles.choix` qui ne sont pas des listes. */
const CLES_RESERVEES = ['dons', 'expertise', 'competences']

const parNom = (a, b) => a.nom.localeCompare(b.nom, 'fr')

export function creerCatalogue(elements) {
  const index = new Map(TYPES.map((t) => [t, new Map()]))
  for (const element of elements) {
    const table = index.get(element.type)
    if (!table) throw new Error(`Type d’élément inconnu : ${element.type}.`)
    if (element.type === 'liste' && CLES_RESERVEES.includes(element.id)) throw new Error(`Id de liste réservé : ${element.id}.`)
    const cle = element.type === 'sous-classe' ? `${element.classe}/${element.id}` : element.id
    if (table.has(cle)) throw new Error(`Élément en double : ${element.type} ${element.id}.`)
    table.set(cle, element)
  }
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
    listesDuGroupe: (groupe) => tous('liste').filter((l) => l.groupe === groupe),
  }
}
