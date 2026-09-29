import { niveauBrume } from './brume.js'

function lieuVisible(etat, ile) {
  if (ile === 'infronde') return ile
  return etat.iles[ile]?.revelee ? ile : null
}

/**
 * Ce que les joueurs ont le droit de voir.
 * Tout le reste (Horloge, croyances, notes, îles et missions cachées)
 * ne sort jamais de l'état du MJ.
 */
export function versPublic(etat) {
  const iles = Object.entries(etat.iles)
    .filter(([, ile]) => ile.revelee)
    .map(([id, ile]) => ({
      id,
      nom: ile.nom,
      x: ile.x,
      y: ile.y,
      r: ile.r,
      statut: ile.statut,
      description: ile.descPublic ?? '',
      alt: ile.mesuree ? ile.alt : null,
      historique: ile.mesuree ? ile.historique ?? [] : [],
    }))

  const missions = Object.entries(etat.missions)
    .filter(([, m]) => m.statut !== 'cachee')
    // Le lieu d'une mission n'est nommé que si l'île est déjà révélée (ou si c'est l'Infronde).
    .map(([id, m]) => ({ id, titre: m.titre, ile: lieuVisible(etat, m.ile), type: m.type, statut: m.statut, accroche: m.teaser ?? '' }))

  return {
    acte: etat.acte,
    session: etat.session,
    brume: niveauBrume(etat.horloge, etat.regles.brume),
    iles,
    missions,
    nouvelles: (etat.nouvelles ?? []).slice(0, 30),
  }
}
