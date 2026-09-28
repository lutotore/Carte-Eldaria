import { niveauBrume } from './brume.js'

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
    .map(([id, m]) => ({ id, titre: m.titre, ile: m.ile, type: m.type, statut: m.statut, accroche: m.teaser ?? '' }))

  return {
    acte: etat.acte,
    session: etat.session,
    brume: niveauBrume(etat.horloge, etat.regles.brume),
    iles,
    missions,
    nouvelles: (etat.nouvelles ?? []).slice(0, 30),
  }
}
