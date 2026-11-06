/**
 * Ce que la fiche affiche d'après les règles : classes et aptitudes niveau par niveau, choix faits, dons, emplacements de sorts.
 * Calculé par le serveur, qui seul connaît les livres : le site ne fait que l'afficher.
 * Un élément absent du catalogue (livre retiré du serveur) reste affiché par son id plutôt que de casser la fiche.
 */
import { COMPETENCES } from '../personnage.js'
import { emplacements } from './emplacements.js'

const OPTIONS_CLASSE = 'options-classe'
const LIBELLES = { expertise: 'Expertise', competences: 'Compétences gagnées', [OPTIONS_CLASSE]: 'Aptitudes optionnelles' }
const NOMS_PARTICULIERS = { 'outils-voleur': 'Outils de voleur' }

const nomDeCompetence = (id) => COMPETENCES.find((c) => c.cle === id)?.nom ?? NOMS_PARTICULIERS[id] ?? id
const estRemplacee = (aptitude, remplacees) => remplacees.some((r) => aptitude === r || aptitude.startsWith(`${r} `))

/** Les aptitudes d'une classe suivie, niveau par niveau, avec les aptitudes optionnelles prises à la place des anciennes. */
function niveauxDe({ classe, niveau, sousClasse }, definition, sous, optionsPrises) {
  if (!definition) return []
  const remplacees = optionsPrises.flatMap((o) => o.remplace?.aptitudes ?? [])
  return Array.from({ length: niveau }, (_, i) => i + 1)
    .map((n) => ({
      niveau: n,
      aptitudes: [
        ...[...(definition.aptitudes[n] ?? []), ...(sousClasse ? sous?.aptitudes?.[n] ?? [] : [])].filter((a) => !estRemplacee(a, remplacees)),
        ...optionsPrises.filter((o) => o.classe === classe && o.niveau === n).map((o) => o.nom),
      ],
    }))
    .filter((n) => n.aptitudes.length)
}

function decrireClasses(regles, catalogue) {
  const prises = regles.choix[OPTIONS_CLASSE] ?? []
  return regles.classes.map((suivie) => {
    const definition = catalogue.classe(suivie.classe)
    const sous = suivie.sousClasse ? catalogue.sousClasse(suivie.classe, suivie.sousClasse) : null
    const optionsPrises = catalogue.optionsDeClasse(suivie.classe).filter((o) => prises.includes(o.id))
    return {
      id: suivie.classe,
      nom: definition?.nom ?? suivie.classe,
      niveau: suivie.niveau,
      de: definition?.de ?? null,
      sousClasse: suivie.sousClasse
        ? { id: suivie.sousClasse, nom: sous?.nom ?? suivie.sousClasse, source: sous?.source ?? null, page: sous?.page ?? null }
        : null,
      niveaux: niveauxDe(suivie, definition, sous, optionsPrises),
    }
  })
}

/** Le nom d'une option choisie : dans sa liste, ou parmi les aptitudes optionnelles des classes suivies. */
function nomDOption(cle, id, regles, catalogue) {
  if (cle === 'expertise' || cle === 'competences') return nomDeCompetence(id)
  if (cle === OPTIONS_CLASSE) {
    return regles.classes.flatMap((c) => catalogue.optionsDeClasse(c.classe)).find((o) => o.id === id)?.nom ?? id
  }
  return catalogue.liste(cle)?.options.find((o) => o.id === id)?.nom ?? id
}

function decrireChoix(regles, catalogue) {
  return Object.entries(regles.choix)
    .filter(([cle, ids]) => cle !== 'dons' && ids.length)
    .map(([cle, ids]) => ({
      libelle: LIBELLES[cle] ?? catalogue.liste(cle)?.nom ?? cle,
      valeurs: ids.map((id) => nomDOption(cle, id, regles, catalogue)),
    }))
}

function decrireDons(regles, catalogue) {
  return (regles.choix.dons ?? []).map((id) => {
    const don = catalogue.don(id)
    return { id, nom: don?.nom ?? id, source: don?.source ?? null, page: don?.page ?? null, resume: don?.resume ?? '' }
  })
}

export function resumeDesRegles(fiche, catalogue) {
  const { regles } = fiche
  return {
    classes: decrireClasses(regles, catalogue),
    choix: decrireChoix(regles, catalogue),
    dons: decrireDons(regles, catalogue),
    emplacements: emplacements(regles, catalogue),
  }
}
