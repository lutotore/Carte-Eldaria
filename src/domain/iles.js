import { niveauBrume } from './brume.js'
import { alerter, journaliser } from './journal.js'

export const TAILLE_HISTORIQUE = 24

/** Altitude visée par le modèle : l'île perd `vitesse` mètres par point d'Horloge au-delà du départ. */
export function altitudeCible(ile, horloge, depart) {
  return Math.round(ile.altInit - (Number(ile.vitesse) || 0) * Math.max(0, horloge - depart))
}

/** Enregistre une altitude dans l'historique ; un même relevé (session) est mis à jour plutôt que dupliqué. */
export function noterReleve(historique = [], session, alt) {
  const suite = historique.map((r) => ({ ...r }))
  const dernier = suite.at(-1)
  if (dernier && dernier.s === session) dernier.alt = alt
  else suite.push({ s: session, alt })
  return suite.slice(-TAILLE_HISTORIQUE)
}

function statutAuRepos(ile) {
  if (ile.instable) return 'instable'
  return (Number(ile.vitesse) || 0) > 0 ? 'descend' : 'stable'
}

/**
 * Recalcule toutes les îles pour l'Horloge courante.
 * Une île ne remonte jamais d'elle-même ; celle qui atteint la brume tombe.
 * Renvoie le nouvel état et la liste des îles tombées pendant le calcul.
 */
export function recalculerIles(etat) {
  const { horloge, session, regles } = etat
  const brume = niveauBrume(horloge, regles.brume)
  const iles = {}
  const tombees = []
  for (const [id, source] of Object.entries(etat.iles)) {
    const ile = { ...source }
    if (ile.statut !== 'tombee') {
      const cible = altitudeCible(ile, horloge, regles.horloge.depart)
      if (cible < ile.alt) {
        ile.alt = cible
        ile.historique = noterReleve(ile.historique, session, cible)
      }
      if (ile.alt <= brume) {
        ile.alt = brume
        ile.statut = 'tombee'
        ile.historique = noterReleve(ile.historique, session, brume)
        tombees.push(id)
      } else {
        ile.statut = statutAuRepos(ile)
      }
    }
    iles[id] = ile
  }
  let suite = { ...etat, iles }
  for (const id of tombees) suite = signalerChute(suite, id, `L'île a atteint la brume (Horloge ${horloge}).`)
  return { etat: suite, tombees }
}

function signalerChute(etat, id, precision) {
  const nom = etat.iles[id].nom
  const avecJournal = journaliser(etat, `${nom} est tombée dans la brume`)
  return alerter(avecJournal, {
    titre: `${nom} est tombée`,
    mj: precision,
    nouvelle: { titre: `${nom} a disparu sous la brume`, texte: 'On ne parle que de ça sur les quais.' },
  })
}

/** Chute scénarisée, déclenchée à la main par le MJ. */
export function faireTomber(etat, id) {
  const ile = etat.iles[id]
  if (!ile) throw new Error(`Île inconnue : ${id}`)
  if (ile.statut === 'tombee') return etat
  const brume = niveauBrume(etat.horloge, etat.regles.brume)
  const tombee = { ...ile, statut: 'tombee', alt: brume, historique: noterReleve(ile.historique, etat.session, brume) }
  return signalerChute({ ...etat, iles: { ...etat.iles, [id]: tombee } }, id, 'Chute déclenchée à la main.')
}

/** Annule une chute (erreur de manipulation) : l'île revient juste au-dessus de la brume. */
export function annulerChute(etat, id) {
  const ile = etat.iles[id]
  if (!ile || ile.statut !== 'tombee') return etat
  const brume = niveauBrume(etat.horloge, etat.regles.brume)
  const relevee = { ...ile, alt: Math.max(ile.alt, brume + 10) }
  relevee.statut = statutAuRepos(relevee)
  return journaliser({ ...etat, iles: { ...etat.iles, [id]: relevee } }, `Chute de ${ile.nom} annulée`)
}

const CHAMPS_MODIFIABLES = new Set(['revelee', 'mesuree', 'vitesse', 'notesMJ'])

/** Modifie un réglage d'île depuis la table du MJ ; changer la vitesse relance le calcul. */
export function modifierIle(etat, id, champ, valeur) {
  const ile = etat.iles[id]
  if (!ile) throw new Error(`Île inconnue : ${id}`)
  if (!CHAMPS_MODIFIABLES.has(champ)) throw new Error(`Champ non modifiable : ${champ}`)
  if (champ === 'vitesse') {
    const vitesse = Number(String(valeur).replace(',', '.'))
    if (!Number.isFinite(vitesse) || vitesse < 0) throw new Error('La vitesse doit être un nombre de mètres positif.')
    valeur = vitesse
  }
  let suite = { ...etat, iles: { ...etat.iles, [id]: { ...ile, [champ]: valeur } } }
  if (champ === 'revelee') suite = journaliser(suite, `${ile.nom} ${valeur ? 'révélée' : 'cachée'} aux joueurs`)
  if (champ === 'vitesse') suite = recalculerIles(suite).etat
  return suite
}
