// Partagé : l'API l'importe aussi.
/**
 * Les notifications du portail : leurs catégories (chaque joueur choisit ce qu'il reçoit sur son téléphone),
 * les rappels de séance, la relance des sondages et ce qui change de visible sur la carte.
 */
import { decrireSeance, versUtc } from './agenda.js'
import { jourAParis } from './planning.js'

export const CATEGORIES = [
  { cle: 'seances', nom: 'Séances', description: 'Sondages de dates, séance fixée ou annulée, rappels avant la séance.' },
  { cle: 'revelations', nom: 'Révélations', description: 'Personnages, créatures, lieux, documents et dates du calendrier que le MJ vous révèle.' },
  { cle: 'personnage', nom: 'Butins et fiche', description: 'Butin à partager, Marque du Rêve sur ta fiche.' },
  { cle: 'annonces', nom: 'Messages du MJ', description: 'Les annonces du MJ, au groupe ou à toi seul.' },
  { cle: 'carte', nom: 'Carte et Gazette', description: 'Nouvelle de la Gazette, ordre de mission, île révélée.' },
]
export const CLES_CATEGORIES = CATEGORIES.map((c) => c.cle)

const MINUTES_PAR_JOUR = 24 * 60
/** Les rappels d'une séance, du plus ancien au plus récent, avec leur heure (minutes depuis minuit du jour de la séance). */
const RAPPELS = [
  { sorte: 'veille', minutes: () => 18 * 60 - MINUTES_PAR_JOUR },
  { sorte: 'bientot', minutes: (seance) => seance.debut - 120 },
]

/**
 * Le rappel à envoyer maintenant pour cette séance, s'il y en a un : le plus récent qui est dû et pas encore parti.
 * Un rappel dépassé par un plus récent n'est jamais rattrapé ; rien ne part une fois la séance commencée.
 */
export function rappelsDus(seance, maintenant, dejaEnvoyes) {
  if (maintenant >= versUtc(seance.jour, seance.debut)) return []
  const dus = RAPPELS.filter((r) => maintenant >= versUtc(seance.jour, r.minutes(seance)))
  const dernier = dus.at(-1)
  if (!dernier || dejaEnvoyes.includes(dernier.sorte)) return []
  // Un rappel dont l'heure était déjà passée quand la séance a été fixée ferait doublon avec l'annonce de la séance.
  if (seance.fixeeLe && new Date(seance.fixeeLe) >= versUtc(seance.jour, dernier.minutes(seance))) return []
  // « Demain » n'est vrai que la veille.
  if (dernier.sorte === 'veille' && jourAParis(maintenant) >= seance.jour) return []
  return [dernier.sorte]
}

/** Les sortes de rappels qui précèdent celle-ci : une fois elle envoyée, elles n'ont plus de sens. */
export const rappelsAnterieurs = (sorte) => RAPPELS.slice(0, RAPPELS.findIndex((r) => r.sorte === sorte) + 1).map((r) => r.sorte)

export function texteRappel(seance, sorte) {
  const lieu = seance.lieu ? ` (${seance.lieu})` : ''
  return sorte === 'veille'
    ? `Rappel : séance demain, ${decrireSeance(seance)}${lieu}.`
    : `La séance commence bientôt : ${decrireSeance(seance)}${lieu}.`
}

/** La relance d'un sondage part la veille de la date limite, entre 10 h et minuit ; jamais pour un sondage ouvert après 10 h ce jour-là. */
export function relanceDue(sondage, maintenant, dejaEnvoyee) {
  if (!sondage.dateLimite || dejaEnvoyee) return false
  const heure = versUtc(sondage.dateLimite, 10 * 60 - MINUTES_PAR_JOUR)
  if (sondage.creeLe && new Date(sondage.creeLe) >= heure) return false
  return maintenant >= heure && maintenant < versUtc(sondage.dateLimite, 0)
}

/**
 * Ce que les joueurs découvrent quand le MJ enregistre la carte : comparaison de deux vues publiques (versPublic).
 * Rien n'est annoncé de ce qui disparaît.
 */
export function nouveautesDuMonde(avant, apres) {
  const cleNouvelle = (n) => JSON.stringify([n.t, n.titre, n.texte])
  const nouvellesAvant = new Set(avant.nouvelles.map(cleNouvelle))
  const missionsAvant = new Set(avant.missions.map((m) => m.id))
  const ilesAvant = new Set(avant.iles.map((i) => i.id))
  return [
    ...apres.nouvelles.filter((n) => !nouvellesAvant.has(cleNouvelle(n))).map((n) => `Gazette des Vents : ${n.titre}.`),
    ...apres.missions.filter((m) => !missionsAvant.has(m.id)).map((m) => `Nouvel ordre de mission : ${m.titre}.`),
    ...apres.iles.filter((i) => !ilesAvant.has(i.id)).map((i) => `Une île apparaît sur la carte : ${i.nom}.`),
  ]
}

/**
 * Services push des navigateurs (Chrome, Firefox, Safari, Edge). Le serveur n'envoie qu'à eux :
 * une adresse fournie par un navigateur ne doit jamais lui faire appeler autre chose (une machine interne, par exemple).
 */
const HOTES_PUSH = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com']
const SUFFIXES_PUSH = ['.push.apple.com', '.notify.windows.com']

export function estAdressePushAutorisee(adresse) {
  let url
  try {
    url = new URL(adresse)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false
  // Le nom d'hôte tel qu'écrit doit être exactement celui que lit URL, en caractères simples : sinon un autre lecteur
  // d'adresse (celui de la bibliothèque d'envoi, par exemple) pourrait appeler une autre machine.
  const ecrit = adresse.slice('https://'.length).split('/')[0]
  if (ecrit !== url.hostname || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(url.hostname)) return false
  return HOTES_PUSH.includes(url.hostname) || SUFFIXES_PUSH.some((s) => url.hostname.endsWith(s))
}
