/**
 * Montée de niveau (règles de 2014), en fonctions pures partagées par le site et l'API.
 * Le site affiche `optionsDeMontee` ; l'API refait `erreurMontee` puis `appliquerMontee` avant d'écrire quoi que ce soit.
 *
 * Une fiche suit les règles quand elle a un champ `regles` :
 *   classes : [{ classe, niveau, sousClasse }]   pvDes : la part du dé de vie gagnée à chaque niveau
 *   choix   : { <liste>: [ids], dons: [ids], expertise: [ids], competences: [ids] }
 *   montees : l'historique des montées faites sur le site, de quoi annuler la dernière.
 * Les PV gagnés sont toujours la moyenne du dé (règle de la table), y compris au premier niveau d'une classe ajoutée par multiclassage.
 */
import { CARACTERISTIQUES, COMPETENCES, modificateur } from '../personnage.js'

const NIVEAU_MAX = 20
const CARAC_MAX = 20
const OUTILS_VOLEUR = { id: 'outils-voleur', nom: 'Outils de voleur' }
const CLES_CARACS = CARACTERISTIQUES.map((c) => c.cle)
const nomCarac = (cle) => CARACTERISTIQUES.find((c) => c.cle === cle).nom

const estObjet = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const somme = (valeurs) => valeurs.reduce((total, v) => total + v, 0)
const moyenneDuDe = (de) => de / 2 + 1
const niveauTotal = (regles) => somme(regles.classes.map((c) => c.niveau))
const classeSuivie = (regles, id) => regles.classes.find((c) => c.classe === id) ?? null
const auNiveau = (table, niveau) => table?.[niveau] ?? []
const tousLesChoix = (regles) => Object.values(regles.choix).flat()

// --- Ce que la fiche affiche ---

function texteClasses(regles, catalogue) {
  return regles.classes.map(({ classe, niveau, sousClasse }) => {
    const sous = sousClasse ? catalogue.sousClasse(classe, sousClasse) : null
    return `${catalogue.classe(classe).nom} ${niveau}${sous ? ` (${sous.nom})` : ''}`
  }).join(' / ')
}

function texteDes(regles, catalogue) {
  const parDe = new Map()
  for (const { classe, niveau } of regles.classes) {
    const de = catalogue.classe(classe).de
    parDe.set(de, (parDe.get(de) ?? 0) + niveau)
  }
  return [...parDe].map(([de, nombre]) => `${nombre}d${de}`).join(' + ')
}

/** Les champs texte de la fiche suivent ce que disent les règles. */
const synchroniser = (fiche, catalogue) => ({
  ...fiche,
  niveau: niveauTotal(fiche.regles),
  classe: texteClasses(fiche.regles, catalogue),
  desDeVie: texteDes(fiche.regles, catalogue),
})

// --- Rattacher une fiche existante ---

/** Une classe seule (`{ classe, sousClasse }`, au niveau de la fiche) ou plusieurs (`{ classes: [{ classe, niveau, sousClasse }] }`). */
const lignesDeClasses = (fiche, demande) => (Array.isArray(demande?.classes)
  ? demande.classes
  : [{ classe: demande?.classe, niveau: fiche.niveau, sousClasse: demande?.sousClasse ?? null }])

function erreurLigneDeClasse({ classe, niveau, sousClasse = null }, catalogue) {
  const definition = catalogue.classe(classe)
  if (!definition) return 'Classe inconnue.'
  if (!Number.isInteger(niveau) || niveau < 1 || niveau > NIVEAU_MAX) return `Le niveau de ${definition.nom} doit aller de 1 à ${NIVEAU_MAX}.`
  if (niveau >= definition.niveauSousClasse) {
    return catalogue.sousClasse(classe, sousClasse) ? null : `Choisis la sous-classe (${definition.nom} de niveau ${niveau}).`
  }
  return sousClasse ? `La sous-classe se choisit au niveau ${definition.niveauSousClasse}.` : null
}

/** Message d'erreur, ou null si la fiche peut suivre les règles avec ces classes (et leurs sous-classes). */
export function erreurRattachement(fiche, demande, catalogue) {
  if (fiche.regles) return 'Cette fiche suit déjà les règles du site.'
  const lignes = lignesDeClasses(fiche, demande)
  if (lignes.length === 0) return 'Indique au moins une classe.'
  if (new Set(lignes.map((l) => l.classe)).size !== lignes.length) return 'Une même classe apparaît deux fois.'
  for (const ligne of lignes) {
    const erreur = erreurLigneDeClasse(ligne, catalogue)
    if (erreur) return erreur
  }
  const total = somme(lignes.map((l) => l.niveau))
  return total === fiche.niveau ? null : `Le total des niveaux de classe doit faire ${fiche.niveau}, le niveau de la fiche.`
}

/** La fiche, rattachée aux règles. Ses PV ne bougent pas : le joueur les a déjà comptés. */
export function rattacher(fiche, demande, catalogue) {
  const erreur = erreurRattachement(fiche, demande, catalogue)
  if (erreur) throw new Error(erreur)
  const lignes = lignesDeClasses(fiche, demande)
  const pvDes = lignes.flatMap(({ classe, niveau }) => Array(niveau).fill(moyenneDuDe(catalogue.classe(classe).de)))
  pvDes[0] = catalogue.classe(lignes[0].classe).de
  const regles = {
    classes: lignes.map(({ classe, niveau, sousClasse = null }) => ({ classe, niveau, sousClasse: sousClasse ?? null })),
    pvDes,
    choix: {},
    montees: [],
  }
  return synchroniser({ ...fiche, regles }, catalogue)
}

// --- Multiclassage ---

function decrirePrerequis(alternatives) {
  return alternatives.map((alt) => Object.entries(alt).map(([cle, min]) => `${nomCarac(cle)} ${min}`).join(' et ')).join(' ou ')
}

/** La raison qui interdit d'ajouter cette classe : il faut les caractéristiques de la nouvelle classe et de celles déjà suivies. */
function raisonMulticlasse(fiche, nouvelle, catalogue) {
  for (const id of [...fiche.regles.classes.map((c) => c.classe), nouvelle]) {
    const classe = catalogue.classe(id)
    const alternatives = classe.multiclasse?.prerequis ?? []
    const remplie = (alt) => Object.entries(alt).every(([cle, min]) => fiche.caracteristiques[cle] >= min)
    if (alternatives.length && !alternatives.some(remplie)) return `Il faut ${decrirePrerequis(alternatives)} (${classe.nom}).`
  }
  return null
}

/** Les classes où prendre le prochain niveau : celles déjà suivies, et les autres si le multiclassage est permis. */
export function classesPossibles(fiche, catalogue) {
  if (!fiche.regles) return []
  return catalogue.classes().map(({ id, nom }) => {
    const suivie = classeSuivie(fiche.regles, id)
    const raison = suivie ? null : raisonMulticlasse(fiche, id, catalogue)
    return { id, nom, niveau: suivie?.niveau ?? 0, disponible: !raison, raison }
  })
}

// --- Ce qui est proposé ---

function optionPermise({ prerequis }, niveauClasse, dejaChoisis) {
  if (!prerequis) return true
  return (prerequis.niveau ?? 0) <= niveauClasse && (!prerequis.choix || dejaChoisis.includes(prerequis.choix))
}

function decrireChoix(choix, fiche, niveauClasse, catalogue) {
  const { competences, regles } = fiche
  const nombre = choix.nombre
  if (choix.type === 'expertise') {
    const options = COMPETENCES.filter((c) => competences[c.cle] === 1).map((c) => ({ id: c.cle, nom: c.nom }))
    if (choix.outils && !(regles.choix.expertise ?? []).includes(OUTILS_VOLEUR.id)) options.push(OUTILS_VOLEUR)
    return { cle: 'expertise', type: 'expertise', libelle: 'Expertise', nombre, options }
  }
  if (choix.type === 'competences') {
    const options = COMPETENCES.filter((c) => !competences[c.cle] && (!choix.parmi || choix.parmi.includes(c.cle))).map((c) => ({ id: c.cle, nom: c.nom }))
    const libelle = choix.parmi ? 'Compétence' : 'Compétences supplémentaires'
    return { cle: 'competences', type: 'competences', libelle, nombre, options, ...(choix.expertise ? { expertise: true } : {}) }
  }
  const liste = catalogue.liste(choix.liste)
  // Un style de combat déjà pris dans une autre classe ne se reprend pas : les listes d'un même groupe se partagent leurs choix.
  const deja = (liste.groupe ? catalogue.listesDuGroupe(liste.groupe) : [liste]).flatMap((l) => regles.choix[l.id] ?? [])
  const choisis = tousLesChoix(regles)
  const options = liste.options
    .filter((option) => (option.repetable || !deja.includes(option.id)) && optionPermise(option, niveauClasse, choisis))
    .map(({ id, nom }) => ({ id, nom }))
  return { cle: liste.id, type: 'liste', libelle: liste.nom, nombre, options }
}

const exigence = ([cle, min]) => `${nomCarac(cle)} ${min}`

function raisonDonIndisponible(don, fiche) {
  if (!don.repetable && (fiche.regles.choix.dons ?? []).includes(don.id)) return 'Tu as déjà ce don.'
  const { caracs = {}, caracsUneDe = null } = don.prerequis ?? {}
  const atteint = ([cle, min]) => fiche.caracteristiques[cle] >= min
  const manque = Object.entries(caracs).find((e) => !atteint(e))
  if (manque) return `${exigence(manque)} requise.`
  if (caracsUneDe && !Object.entries(caracsUneDe).some(atteint)) return `${Object.entries(caracsUneDe).map(exigence).join(' ou ')} requise.`
  return null
}

/** Un don : ses prérequis (ceux que le site ne peut pas vérifier sont seulement rappelés) et ses propres choix. */
function decrireDon(don, fiche, decrire) {
  const raison = raisonDonIndisponible(don, fiche)
  return {
    id: don.id, nom: don.nom, source: don.source, page: don.page ?? null, resume: don.resume ?? '', amelioration: don.amelioration ?? null,
    disponible: !raison, raison, aVerifier: don.prerequis?.note ?? null, choix: decrire(don.choix ?? []),
  }
}

/** Quand une compétence et l'expertise se gagnent au même niveau, l'expertise peut porter sur la compétence qu'on vient de prendre. */
function lierExpertise(choix) {
  if (!choix.some((c) => c.cle === 'competences')) return choix
  return choix.map((c) => (c.cle === 'expertise' ? { ...c, avecLesNouvelles: true } : c))
}

const bonusPvDesDons = (ids, catalogue) => somme(ids.map((id) => catalogue.don(id)?.pvParNiveau ?? 0))

// --- Aptitudes optionnelles de classe (Tasha) : elles s'ajoutent, ou remplacent une aptitude et ses choix ---

const OPTIONS_CLASSE = 'options-classe'

/** Ce que remplacent les aptitudes optionnelles prises : noms d'aptitudes (et leurs versions améliorées), listes de choix. */
function remplacements(ids, catalogue, classeId) {
  const prises = catalogue.optionsDeClasse(classeId).filter((o) => ids.includes(o.id))
  return {
    aptitudes: prises.flatMap((o) => o.remplace?.aptitudes ?? []),
    listes: prises.flatMap((o) => o.remplace?.listes ?? []),
  }
}

const sansRemplacees = (aptitudes, remplacees) => aptitudes.filter((a) => !remplacees.some((r) => a === r || a.startsWith(`${r} `)))

/**
 * Ce que le joueur gagne et doit choisir en prenant un niveau dans cette classe.
 * `{ possible: false, raison }` quand il n'y a pas de montée à faire.
 */
export function optionsDeMontee(fiche, catalogue, classeId = fiche.regles?.classes[0]?.classe) {
  const { regles } = fiche
  if (!regles) return { possible: false, raison: 'Choisis d’abord la classe de ton personnage pour suivre les règles du site.' }
  if (niveauTotal(regles) >= NIVEAU_MAX) return { possible: false, raison: 'Ton personnage est au niveau 20 : il n’y a plus de niveau à prendre.' }
  const classe = catalogue.classe(classeId)
  if (!classe) return { possible: false, raison: 'Classe inconnue.' }
  const suivie = classeSuivie(regles, classeId)
  const raison = suivie ? null : raisonMulticlasse(fiche, classeId, catalogue)
  if (raison) return { possible: false, raison }

  // En entrant dans une classe par multiclassage : ses maîtrises (pas toutes) et ses choix d'entrée ; les PV restent la moyenne.
  const entree = suivie ? null : classe.multiclasse ?? {}
  const niveauClasse = (suivie?.niveau ?? 0) + 1
  const sousClasse = suivie?.sousClasse ? catalogue.sousClasse(classeId, suivie.sousClasse) : null
  const choix = (definitions) => definitions.map((c) => decrireChoix(c, fiche, niveauClasse, catalogue))
  const moyenne = moyenneDuDe(classe.de)
  const remplacees = remplacements(regles.choix[OPTIONS_CLASSE] ?? [], catalogue, classeId)
  const optionnelles = catalogue.optionsDeClasse(classeId)
    .filter((o) => o.niveau === niveauClasse && !(regles.choix[OPTIONS_CLASSE] ?? []).includes(o.id))
    .map((o) => ({
      id: o.id, nom: o.nom, source: o.source, page: o.page ?? null, resume: o.resume ?? '',
      remplace: { aptitudes: o.remplace?.aptitudes ?? [], listes: o.remplace?.listes ?? [] }, choix: choix(o.choix ?? []),
    }))
  const bonus = bonusPvDesDons(regles.choix.dons ?? [], catalogue) + (sousClasse?.pvParNiveau ?? 0)

  return {
    possible: true,
    classe: { id: classe.id, nom: classe.nom },
    niveauClasse,
    niveauTotal: niveauTotal(regles) + 1,
    pv: { de: classe.de, moyenne, gain: Math.max(1, moyenne + modificateur(fiche.caracteristiques.con)) + bonus },
    aptitudes: [
      ...(entree?.maitrises ? [`Maîtrises du multiclassage : ${entree.maitrises}`] : []),
      ...sansRemplacees([...auNiveau(classe.aptitudes, niveauClasse), ...auNiveau(sousClasse?.aptitudes, niveauClasse)], remplacees.aptitudes),
    ],
    sousClasse: niveauClasse === classe.niveauSousClasse
      ? catalogue.sousClassesDe(classeId).map((s) => ({
        id: s.id, nom: s.nom, source: s.source, page: s.page ?? null, aptitudes: auNiveau(s.aptitudes, niveauClasse), choix: choix(auNiveau(s.choix, niveauClasse)),
      }))
      : null,
    amelioration: classe.ameliorations.includes(niveauClasse)
      ? { caracs: { ...fiche.caracteristiques }, dons: catalogue.dons().map((d) => decrireDon(d, fiche, choix)) }
      : null,
    choix: lierExpertise(choix([...(entree?.choix ?? []), ...auNiveau(classe.choix, niveauClasse), ...auNiveau(sousClasse?.choix, niveauClasse)])
      .filter((c) => !remplacees.listes.includes(c.cle))),
    optionnelles,
    aVenir: (classe.incantation ?? sousClasse?.incantation) ? ['Sorts appris et préparés : note-les sur la fiche, le site ne gère pas encore les sorts.'] : [],
  }
}

// --- Vérifier une demande ---

const MANQUE_AMELIORATION = 'Choisis ton amélioration : +2 en caractéristiques (ou +1 à deux), ou un don.'

function erreurDon(amelioration, options, fiche, catalogue) {
  const don = catalogue.don(amelioration.don)
  if (!don) return 'Don inconnu.'
  const { raison } = options.amelioration.dons.find((d) => d.id === don.id)
  if (raison) return raison
  const { caracs } = amelioration
  if (!don.amelioration) return caracs == null ? null : 'Ce don n’augmente aucune caractéristique.'
  const { parmi, valeur } = don.amelioration
  const cles = estObjet(caracs) ? Object.keys(caracs) : []
  if (cles.length !== 1 || !parmi.includes(cles[0]) || caracs[cles[0]] !== valeur) {
    return `Choisis la caractéristique que ce don augmente (${parmi.map(nomCarac).join(' ou ')}).`
  }
  return fiche.caracteristiques[cles[0]] + valeur > CARAC_MAX ? `Une caractéristique ne dépasse pas ${CARAC_MAX}.` : null
}

function erreurCaracs(caracs, fiche) {
  if (!estObjet(caracs)) return MANQUE_AMELIORATION
  const cles = Object.keys(caracs)
  if (!cles.every((c) => CLES_CARACS.includes(c))) return 'Caractéristique inconnue.'
  if (!cles.every((c) => caracs[c] === 1 || caracs[c] === 2) || somme(cles.map((c) => caracs[c])) !== 2) {
    return 'Répartis 2 points : +2 à une caractéristique, ou +1 à deux.'
  }
  return cles.some((c) => fiche.caracteristiques[c] + caracs[c] > CARAC_MAX) ? `Une caractéristique ne dépasse pas ${CARAC_MAX}.` : null
}

function erreurAmelioration(amelioration, options, fiche, catalogue) {
  if (!options.amelioration) return amelioration == null ? null : 'Pas d’amélioration de caractéristiques à ce niveau.'
  if (!estObjet(amelioration)) return MANQUE_AMELIORATION
  return amelioration.don != null ? erreurDon(amelioration, options, fiche, catalogue) : erreurCaracs(amelioration.caracs, fiche)
}

function erreurOptionnelles(optionnelles, options) {
  if (!Array.isArray(optionnelles) || new Set(optionnelles).size !== optionnelles.length) return 'Aptitudes optionnelles invalides.'
  const inconnue = optionnelles.find((id) => !options.optionnelles.some((o) => o.id === id))
  return inconnue ? `Aptitude optionnelle non disponible à ce niveau : ${inconnue}.` : null
}

function erreurSousClasse(sousClasse, options) {
  if (!options.sousClasse) return sousClasse == null ? null : 'Pas de sous-classe à choisir à ce niveau.'
  return options.sousClasse.some((s) => s.id === sousClasse) ? null : 'Choisis une sous-classe.'
}

/** Les choix à faire : ceux de la classe et de la sous-classe actuelle, plus ceux de la sous-classe choisie maintenant. */
const choixAttendus = (options, { sousClasse = null, amelioration = null, optionnelles = [] }) => lierExpertise([
  ...options.choix.filter((c) => !options.optionnelles
    .some((o) => optionnelles.includes(o.id) && o.remplace.listes.includes(c.cle))),
  ...options.optionnelles.filter((o) => optionnelles.includes(o.id)).flatMap((o) => o.choix),
  ...(options.sousClasse?.find((s) => s.id === sousClasse)?.choix ?? []),
  ...(options.amelioration?.dons.find((d) => d.id === amelioration?.don)?.choix ?? []),
])

function erreurChoix(choix, attendus) {
  if (!estObjet(choix)) return 'Choix invalides.'
  const inattendu = Object.keys(choix).find((cle) => !attendus.some((a) => a.cle === cle))
  if (inattendu) return `Choix inattendu : ${inattendu}.`
  for (const { cle, libelle, nombre, options, avecLesNouvelles } of attendus) {
    const pris = choix[cle]
    const permis = [...options.map((o) => o.id), ...(avecLesNouvelles && Array.isArray(choix.competences) ? choix.competences : [])]
    if (!Array.isArray(pris) || pris.length === 0) return `${libelle} : fais ton choix.`
    if (pris.length !== nombre) return `${libelle} : choisis-en ${nombre}.`
    if (new Set(pris).size !== pris.length) return `${libelle} : une même option deux fois.`
    if (!pris.every((id) => permis.includes(id))) return `${libelle} : option non disponible.`
  }
  return null
}

/** Message d'erreur, ou null si la montée demandée respecte les règles. */
export function erreurMontee(fiche, demande, catalogue) {
  if (!estObjet(demande)) return 'Demande de montée de niveau invalide.'
  const options = optionsDeMontee(fiche, catalogue, demande.classe)
  if (!options.possible) return options.raison
  const { sousClasse = null, amelioration = null, choix = {}, optionnelles = [] } = demande
  return erreurOptionnelles(optionnelles, options)
    ?? erreurSousClasse(sousClasse, options)
    ?? erreurAmelioration(amelioration, options, fiche, catalogue)
    ?? erreurChoix(choix, choixAttendus(options, demande))
}

// --- Appliquer, annuler ---

function ajouterCaracs(caracteristiques, ajouts, signe = 1) {
  const resultat = { ...caracteristiques }
  for (const [cle, valeur] of Object.entries(ajouts)) resultat[cle] += signe * valeur
  return resultat
}

/** Les compétences changées par l'expertise et les compétences supplémentaires, et leur niveau d'avant. */
function nouvellesCompetences(competences, choix, { expertiseDirecte = false } = {}) {
  const resultat = { ...competences }
  const avant = {}
  const changer = (cle, niveau) => {
    avant[cle] = competences[cle] ?? 0
    resultat[cle] = niveau
  }
  // Les nouvelles compétences d'abord : l'expertise peut porter sur l'une d'elles.
  for (const id of choix.competences ?? []) changer(id, expertiseDirecte ? 2 : 1)
  for (const id of choix.expertise ?? []) if (COMPETENCES.some((c) => c.cle === id)) changer(id, 2)
  return { competences: resultat, avant }
}

const copieDesChoix = (choix) => Object.fromEntries(Object.entries(choix).map(([cle, ids]) => [cle, [...ids]]))

function fusionnerChoix(choix, ajouts) {
  const resultat = { ...choix }
  for (const [cle, ids] of Object.entries(ajouts)) resultat[cle] = [...(resultat[cle] ?? []), ...ids]
  return resultat
}

function retirerChoix(choix, retraits) {
  const resultat = { ...choix }
  for (const [cle, ids] of Object.entries(retraits)) {
    const restants = (resultat[cle] ?? []).filter((id) => !ids.includes(id))
    if (restants.length) resultat[cle] = restants
    else delete resultat[cle]
  }
  return resultat
}

/** PV gagnés : moyenne du dé + Con (au moins 1), bonus par niveau, et ce qui devient rétroactif à ce niveau. */
function pvGagnes({ fiche, classe, suivie, sousClasseChoisie, don, caracteristiques, catalogue }) {
  const { regles } = fiche
  const niveauxAvant = niveauTotal(regles)
  const modAvant = modificateur(fiche.caracteristiques.con)
  const modApres = modificateur(caracteristiques.con)
  const sousClasse = catalogue.sousClasse(classe.id, sousClasseChoisie ?? suivie?.sousClasse)
  const bonusParNiveau = bonusPvDesDons(regles.choix.dons ?? [], catalogue) + (don?.pvParNiveau ?? 0) + (sousClasse?.pvParNiveau ?? 0)
  const retroactif = (modApres - modAvant) * niveauxAvant
    + (don?.pvParNiveau ?? 0) * niveauxAvant
    + (sousClasseChoisie ? (sousClasse.pvParNiveau ?? 0) * (suivie?.niveau ?? 0) : 0)
  return Math.max(1, moyenneDuDe(classe.de) + modApres) + bonusParNiveau + retroactif
}

/** La fiche après la montée. La demande doit avoir passé `erreurMontee`. */
export function appliquerMontee(fiche, demande, catalogue) {
  const erreur = erreurMontee(fiche, demande, catalogue)
  if (erreur) throw new Error(erreur)
  const { regles } = fiche
  const classe = catalogue.classe(demande.classe)
  const suivie = classeSuivie(regles, classe.id)
  const sousClasseChoisie = demande.sousClasse ?? null
  const amelioration = demande.amelioration ?? null
  const don = amelioration?.don ? catalogue.don(amelioration.don) : null
  const caracs = amelioration?.caracs ?? {}
  const optionnelles = demande.optionnelles ?? []
  const choix = { ...(demande.choix ?? {}), ...(optionnelles.length ? { [OPTIONS_CLASSE]: optionnelles } : {}) }

  const attendus = choixAttendus(optionsDeMontee(fiche, catalogue, classe.id), demande)
  const caracteristiques = ajouterCaracs(fiche.caracteristiques, caracs)
  const expertiseDirecte = Boolean(attendus.find((c) => c.cle === 'competences')?.expertise)
  const { competences, avant } = nouvellesCompetences(fiche.competences, choix, { expertiseDirecte })
  // Résistant : la sauvegarde de la caractéristique augmentée, si elle n'était pas déjà maîtrisée.
  const carac = Object.keys(caracs)[0]
  const sauvegarde = don?.sauvegarde && !fiche.sauvegardes.includes(carac) ? carac : null
  const pv = pvGagnes({ fiche, classe, suivie, sousClasseChoisie, don, caracteristiques, catalogue })
  const montee = {
    classe: classe.id, niveau: niveauTotal(regles) + 1, pv, sousClasse: sousClasseChoisie,
    caracs: { ...caracs }, don: don?.id ?? null, sauvegarde, choix: copieDesChoix(choix), competences: avant,
  }
  const nouvellesRegles = {
    classes: suivie
      ? regles.classes.map((c) => (c === suivie ? { ...c, niveau: c.niveau + 1, sousClasse: sousClasseChoisie ?? c.sousClasse } : c))
      : [...regles.classes, { classe: classe.id, niveau: 1, sousClasse: sousClasseChoisie }],
    pvDes: [...regles.pvDes, moyenneDuDe(classe.de)],
    choix: fusionnerChoix(regles.choix, don ? { ...choix, dons: [don.id] } : choix),
    montees: [...regles.montees, montee],
  }
  return synchroniser({
    ...fiche, caracteristiques, competences, sauvegardes: sauvegarde ? [...fiche.sauvegardes, sauvegarde] : fiche.sauvegardes, pvMax: fiche.pvMax + pv, pvActuels: fiche.pvActuels + pv, regles: nouvellesRegles,
  }, catalogue)
}

/** La fiche d'avant la dernière montée faite sur le site. */
export function annulerDerniereMontee(fiche, catalogue) {
  const montee = fiche.regles?.montees.at(-1)
  if (!montee) throw new Error('Aucune montée de niveau faite sur le site à annuler.')
  const { regles } = fiche
  const competences = { ...fiche.competences }
  for (const [cle, niveau] of Object.entries(montee.competences)) {
    if (niveau) competences[cle] = niveau
    else delete competences[cle]
  }
  const nouvellesRegles = {
    classes: regles.classes.map((c) => (c.classe === montee.classe
      ? { ...c, niveau: c.niveau - 1, sousClasse: montee.sousClasse ? null : c.sousClasse } : c))
      .filter((c) => c.niveau > 0),
    pvDes: regles.pvDes.slice(0, -1),
    choix: retirerChoix(regles.choix, montee.don ? { ...montee.choix, dons: [montee.don] } : montee.choix),
    montees: regles.montees.slice(0, -1),
  }
  return synchroniser({
    ...fiche,
    caracteristiques: ajouterCaracs(fiche.caracteristiques, montee.caracs, -1),
    competences,
    sauvegardes: montee.sauvegarde ? fiche.sauvegardes.filter((s) => s !== montee.sauvegarde) : fiche.sauvegardes,
    pvMax: fiche.pvMax - montee.pv,
    pvActuels: fiche.pvActuels - montee.pv,
    regles: nouvellesRegles,
  }, catalogue)
}
