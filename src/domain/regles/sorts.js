/**
 * Sorts des classes (règles de 2014) : ce que chaque classe qui lance des sorts peut connaître ou préparer,
 * et la vérification d'une sélection. Le joueur choisit ses sorts dans le panneau Sorts de sa fiche ;
 * la montée de niveau se contente d'annoncer ce qu'elle apporte (`nouveauxSorts`).
 *
 * `regles.sorts` : { <classe>: { toursDeMagie, connus, grimoire, prepares, arcanum } } (listes d'ids de sorts).
 */
import { bonusMaitrise, modificateur } from '../personnage.js'
import { niveauMaxDeSort } from './emplacements.js'

const CLES_PAR_MODE = {
  connus: ['toursDeMagie', 'connus', 'arcanum'],
  prepares: ['toursDeMagie', 'prepares'],
  grimoire: ['toursDeMagie', 'grimoire', 'prepares'],
}
const CLES = ['toursDeMagie', 'connus', 'grimoire', 'prepares', 'arcanum']

const estObjet = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const pluriel = (n, un, plusieurs) => (n > 1 ? plusieurs : un)
/** Total des valeurs d'une table par paliers ({ 10: 2, 14: 2 }) jusqu'à ce niveau. */
const cumul = (paliers, niveau) => Object.entries(paliers ?? {}).filter(([n]) => Number(n) <= niveau).reduce((t, [, v]) => t + v, 0)
const parNiveau = (table, niveau) => (niveau >= 1 ? table?.[niveau - 1] ?? 0 : 0)

/**
 * Comment une classe suivie lance ses sorts : par elle-même, ou par sa sous-classe (Chevalier occulte, Arnaqueur arcanique).
 * Une sous-classe peut aussi seulement ajouter des secrets magiques (Collège du savoir).
 */
function progression(definition, sous) {
  if (!definition) return null
  if (sous?.sorts?.mode) return { ...sous.sorts, incantation: sous.incantation, nom: `${definition.nom} (${sous.nom})` }
  if (!definition.sorts) return null
  return { ...definition.sorts, liste: definition.sorts.liste ?? definition.id, incantation: definition.incantation, nom: definition.nom, secretsSous: sous?.sorts?.secrets }
}

function limitesDe(prog, niveau, fiche) {
  const mod = modificateur(fiche.caracteristiques[prog.carac])
  const prepares = { niveau: niveau, demi: Math.floor(niveau / 2) }[prog.prepares]
  return {
    toursDeMagie: parNiveau(prog.tours, niveau),
    connus: prog.connus ? parNiveau(prog.connus, niveau) + cumul(prog.secretsSous, niveau) : null,
    secrets: cumul(prog.secrets, niveau) + cumul(prog.secretsSous, niveau),
    prepares: prepares === undefined ? null : Math.max(1, mod + prepares),
    grimoire: prog.grimoire ? prog.grimoire.depart + prog.grimoire.parNiveau * (niveau - 1) : null,
    arcanum: Object.entries(prog.arcanum ?? {}).filter(([n]) => Number(n) <= niveau).map(([, sort]) => sort),
  }
}

/** Sorts donnés d'office par la sous-classe à ce niveau (y compris selon un choix, comme la terre du druide), et sorts ajoutés à la liste. */
function sortsDeSousClasse(suivie, regles, catalogue) {
  const elements = suivie.sousClasse ? catalogue.sortsAccordes(suivie.classe, suivie.sousClasse) : []
  const jusquA = (table) => Object.entries(table ?? {}).filter(([n]) => Number(n) <= suivie.niveau).flatMap(([, ids]) => ids)
  const choisi = (e) => (e.parChoix ? (regles.choix[e.parChoix.liste] ?? [])[0] : null)
  const accordes = elements.filter((e) => e.mode !== 'etendus')
    .flatMap((e) => [...jusquA(e.niveaux), ...jusquA(e.parChoix?.options?.[choisi(e)])])
  // Listes étendues : rangées par niveau de sort, toutes accessibles (le niveau maximal filtre ensuite).
  const etendus = elements.filter((e) => e.mode === 'etendus')
    .flatMap((e) => [...Object.values(e.niveaux ?? {}).flat(), ...Object.values(e.parChoix?.options?.[choisi(e)] ?? {}).flat()])
  return { accordes: [...new Set(accordes)], etendus }
}

const decrire = (sort) => ({
  nom: sort.nom, niveau: sort.niveau, ecole: sort.ecole, rituel: Boolean(sort.rituel), concentration: Boolean(sort.concentration),
  source: sort.source, page: sort.page ?? null,
})

function etatDUneClasse(suivie, fiche, catalogue) {
  const definition = catalogue.classe(suivie.classe)
  const sous = suivie.sousClasse ? catalogue.sousClasse(suivie.classe, suivie.sousClasse) : null
  const prog = progression(definition, sous)
  if (!prog) return null
  const niveauMax = niveauMaxDeSort(prog.incantation, suivie.niveau)
  const limites = limitesDe(prog, suivie.niveau, fiche)
  if (niveauMax === 0 && limites.toursDeMagie === 0) return null

  const { accordes, etendus } = sortsDeSousClasse(suivie, fiche.regles, catalogue)
  const deLaListe = catalogue.sorts().filter((s) => s.classes.includes(prog.liste) || etendus.includes(s.id))
  const auNiveau = (min, max) => (s) => s.niveau >= min && s.niveau <= max
  const ids = (sorts) => sorts.map((s) => s.id)
  const sortsDeClasse = ids(deLaListe.filter(auNiveau(1, niveauMax))).filter((id) => !accordes.includes(id))
  const enregistres = fiche.regles.sorts?.[suivie.classe] ?? {}
  const choisis = Object.fromEntries(CLES.map((cle) => [cle, [...(enregistres[cle] ?? [])]]))
  const options = {
    toursDeMagie: ids(deLaListe.filter(auNiveau(0, 0))),
    sorts: sortsDeClasse,
    secrets: limites.secrets ? ids(catalogue.sorts().filter(auNiveau(1, niveauMax))).filter((id) => !sortsDeClasse.includes(id)) : [],
    prepares: prog.mode === 'grimoire' ? choisis.grimoire : prog.mode === 'prepares' ? sortsDeClasse : [],
    arcanum: Object.fromEntries(limites.arcanum.map((n) => [n, ids(deLaListe.filter(auNiveau(n, n)))])),
  }
  const cites = new Set([...accordes, ...Object.values(options).flatMap((o) => (Array.isArray(o) ? o : Object.values(o).flat())), ...Object.values(choisis).flat()])
  const mod = modificateur(fiche.caracteristiques[prog.carac])
  const maitrise = bonusMaitrise(fiche.niveau)
  return {
    classe: suivie.classe, nom: prog.nom, mode: prog.mode, caracteristique: prog.carac,
    dd: 8 + maitrise + mod, attaque: maitrise + mod, niveauMax, limites, accordes, choisis, options,
    ecoles: prog.ecoles ?? null, horsEcoles: (prog.libres ?? []).filter((n) => n <= suivie.niveau).length,
    sorts: Object.fromEntries([...cites].filter((id) => catalogue.sort(id)).map((id) => [id, decrire(catalogue.sort(id))])),
  }
}

/** Pour chaque classe suivie qui lance des sorts : limites, sorts accordés, options, sélection actuelle. */
export function etatDesSorts(fiche, catalogue) {
  if (!fiche.regles) return []
  return fiche.regles.classes.map((suivie) => etatDUneClasse(suivie, fiche, catalogue)).filter(Boolean)
}

// --- Vérifier une sélection ---

function erreurListe(liste, catalogue) {
  if (!Array.isArray(liste) || !liste.every((id) => typeof id === 'string')) return 'Liste de sorts invalide.'
  const inconnu = liste.find((id) => !catalogue.sort(id))
  if (inconnu) return `Sort inconnu : ${inconnu}.`
  const double = liste.find((id, i) => liste.indexOf(id) !== i)
  return double ? `${catalogue.sort(double).nom} apparaît deux fois.` : null
}

function erreurToursDeMagie(liste, etat, nom) {
  if (liste.length > etat.limites.toursDeMagie) return `${etat.nom} : ${etat.limites.toursDeMagie} tours de magie au plus.`
  const hors = liste.find((id) => !etat.options.toursDeMagie.includes(id))
  return hors ? `${nom(hors)} n’est pas un tour de magie de ${etat.nom}.` : null
}

/** Un sort de niveau 1 au niveau maximal de la classe. */
function erreurNiveau(liste, etat, nom, catalogue) {
  const tour = liste.find((id) => catalogue.sort(id).niveau === 0)
  if (tour) return `${nom(tour)} est un tour de magie.`
  const tropHaut = liste.find((id) => catalogue.sort(id).niveau > etat.niveauMax)
  return tropHaut ? `${nom(tropHaut)} : ${etat.nom} ne lance pas encore de sorts de ce niveau.` : null
}

function erreurConnus(liste, etat, nom, catalogue) {
  if (liste.length > etat.limites.connus) return `${etat.nom} : ${etat.limites.connus} sorts connus au plus.`
  const niveau = erreurNiveau(liste, etat, nom, catalogue)
  if (niveau) return niveau
  const horsListe = liste.filter((id) => !etat.options.sorts.includes(id))
  if (horsListe.length > etat.limites.secrets) {
    return etat.limites.secrets
      ? `Au plus ${etat.limites.secrets} secrets magiques pris hors de la liste de ${etat.nom}.`
      : `${nom(horsListe[0])} n’est pas dans la liste de ${etat.nom}.`
  }
  if (!etat.ecoles) return null
  const horsEcoles = liste.filter((id) => !etat.ecoles.includes(catalogue.sort(id).ecole))
  return horsEcoles.length > etat.horsEcoles
    ? `${etat.nom} : au plus ${etat.horsEcoles} sort(s) hors des écoles ${etat.ecoles.join(' et ')}.` : null
}

function erreurGrimoire(liste, etat, nom, catalogue) {
  const niveau = erreurNiveau(liste, etat, nom, catalogue)
  if (niveau) return niveau
  const hors = liste.find((id) => !etat.options.sorts.includes(id))
  return hors ? `${nom(hors)} n’est pas un sort de ${etat.nom}.` : null
}

function erreurPrepares(liste, etat, nom, grimoire) {
  if (liste.length > etat.limites.prepares) return `${etat.nom} : ${etat.limites.prepares} sorts préparés au plus.`
  const accorde = liste.find((id) => etat.accordes.includes(id))
  if (accorde) return `${nom(accorde)} est déjà toujours préparé.`
  if (etat.mode === 'grimoire') {
    const absent = liste.find((id) => !grimoire.includes(id))
    return absent ? `${nom(absent)} n’est pas dans ton grimoire.` : null
  }
  const hors = liste.find((id) => !etat.options.sorts.includes(id))
  return hors ? `${nom(hors)} : sort que ${etat.nom} ne peut pas préparer.` : null
}

function erreurArcanum(liste, etat, nom, catalogue) {
  const niveaux = liste.map((id) => catalogue.sort(id).niveau)
  const sansPlace = liste.find((id, i) => !etat.limites.arcanum.includes(niveaux[i]) || niveaux.indexOf(niveaux[i]) !== i
    || !etat.options.arcanum[niveaux[i]].includes(id))
  return sansPlace ? `${nom(sansPlace)} : pas d’arcanum mystique possible pour ce sort.` : null
}

/** Message d'erreur, ou null si la sélection (partielle) de sorts de cette classe respecte les règles. */
export function erreurSorts(fiche, classeId, selection, catalogue) {
  if (!estObjet(selection)) return 'Sélection de sorts invalide.'
  const etat = etatDesSorts(fiche, catalogue).find((e) => e.classe === classeId)
  if (!etat) return `Ce personnage ne lance pas de sorts de ${catalogue.classe(classeId)?.nom ?? classeId}.`
  const permises = CLES_PAR_MODE[etat.mode]
  const inattendue = Object.keys(selection).find((cle) => !permises.includes(cle))
  if (inattendue) return `Choix de sorts inattendu pour ${etat.nom} : ${inattendue}.`
  for (const cle of Object.keys(selection)) {
    const erreur = erreurListe(selection[cle], catalogue)
    if (erreur) return erreur
  }
  const nom = (id) => catalogue.sort(id).nom
  const grimoire = selection.grimoire ?? etat.choisis.grimoire
  const verifications = {
    toursDeMagie: (l) => erreurToursDeMagie(l, etat, nom),
    connus: (l) => erreurConnus(l, etat, nom, catalogue),
    grimoire: (l) => erreurGrimoire(l, etat, nom, catalogue),
    prepares: (l) => erreurPrepares(l, etat, nom, grimoire),
    arcanum: (l) => erreurArcanum(l, etat, nom, catalogue),
  }
  for (const [cle, liste] of Object.entries(selection)) {
    const erreur = verifications[cle](liste)
    if (erreur) return erreur
  }
  return null
}

/** La fiche avec la sélection enregistrée. Elle doit avoir passé `erreurSorts`. */
export function appliquerSorts(fiche, classeId, selection) {
  const sorts = { ...(fiche.regles.sorts ?? {}) }
  sorts[classeId] = { ...(sorts[classeId] ?? {}), ...Object.fromEntries(Object.entries(selection).map(([cle, ids]) => [cle, [...ids]])) }
  return { ...fiche, regles: { ...fiche.regles, sorts } }
}

// --- Ce qu'annonce la montée de niveau ---

/** Vrai si les règles du site savent comment cette classe (ou sa sous-classe) lance des sorts. */
export const connaitLesSorts = (definition, sous) => Boolean(progression(definition, sous))

/** Ce que le passage de `niveauActuel` à `niveauActuel + 1` apporte en sorts, en phrases courtes. */
export function nouveauxSorts(definition, sous, niveauActuel) {
  const prog = progression(definition, sous)
  if (!prog) return []
  const apres = niveauActuel + 1
  const ecart = (table) => parNiveau(table, apres) - parNiveau(table, niveauActuel)
  const tours = ecart(prog.tours)
  const secrets = cumul(prog.secrets, apres) - cumul(prog.secrets, niveauActuel) + cumul(prog.secretsSous, apres) - cumul(prog.secretsSous, niveauActuel)
  const connus = prog.connus ? ecart(prog.connus) + cumul(prog.secretsSous, apres) - cumul(prog.secretsSous, niveauActuel) : 0
  const niveauMax = niveauMaxDeSort(prog.incantation, apres)
  const phrases = []
  if (tours > 0) phrases.push(`+${tours} ${pluriel(tours, 'tour', 'tours')} de magie`)
  if (connus > 0) {
    const dont = secrets > 0 ? `, dont ${secrets} ${pluriel(secrets, 'secret magique pris', 'secrets magiques pris')} dans n’importe quelle liste` : ''
    phrases.push(`+${connus} ${pluriel(connus, 'sort connu', 'sorts connus')}${dont}`)
  }
  if (prog.grimoire) phrases.push(niveauActuel === 0 ? `${prog.grimoire.depart} sorts dans ton grimoire` : `+${prog.grimoire.parNiveau} sorts dans ton grimoire`)
  if (prog.arcanum?.[apres]) phrases.push(`un arcanum mystique de niveau ${prog.arcanum[apres]}`)
  if (niveauMax > niveauMaxDeSort(prog.incantation, niveauActuel)) phrases.push(`sorts jusqu’au niveau ${niveauMax}`)
  return phrases
}
