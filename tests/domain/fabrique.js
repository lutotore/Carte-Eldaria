/** Un petit monde de test, indépendant des vraies données de campagne. */
export function unMonde(surcharges = {}) {
  return {
    version: 1,
    regles: {
      horloge: { depart: 3, max: 20 },
      brume: { base: 1150, monteeDes: 18, pas: 150 },
      seuils: [
        { s: 5, titre: 'Premier seuil', mj: 'Il se passe quelque chose.', nouvelle: { titre: 'Rumeur', texte: 'On raconte…' } },
        { s: 8, titre: 'Deuxième seuil', mj: 'Ça empire.' },
      ],
      evenements: [{ libelle: "Fin de l'acte I", delta: 2 }, { libelle: 'Moratoire', delta: -2 }],
      lectures: [{ cle: 'a', nom: 'Lecture A' }, { cle: 'b', nom: 'Lecture B' }],
      indices: [],
      factions: [{ cle: 'guilde', nom: 'La Guilde' }],
    },
    horloge: 3,
    acte: 1,
    session: 'Session 1',
    croyances: { a: 0, b: 0 },
    reputations: { guilde: 0 },
    pjs: [{ nom: 'Aria', marques: 0 }],
    seuilsVus: [],
    alertes: [],
    journal: [],
    nouvelles: [],
    iles: {
      basse: { nom: 'Basse', x: 0, y: 0, r: 10, altInit: 1200, alt: 1200, vitesse: 25, revelee: true, mesuree: true, statut: 'descend', historique: [{ s: 'Session 1', alt: 1200 }] },
      haute: { nom: 'Haute', x: 0, y: 0, r: 10, altInit: 3000, alt: 3000, vitesse: 0, revelee: true, mesuree: false, statut: 'stable', historique: [] },
      secrete: { nom: 'Secrète', x: 0, y: 0, r: 10, altInit: 2000, alt: 2000, vitesse: 5, revelee: false, mesuree: true, statut: 'descend', notesMJ: 'spoiler', historique: [] },
      folle: { nom: 'Folle', x: 0, y: 0, r: 10, altInit: 1900, alt: 1900, vitesse: 0, instable: true, revelee: true, mesuree: true, statut: 'instable', historique: [] },
    },
    missions: {
      principale: { titre: 'Mission principale', ile: 'basse', type: 'principale', acte: 1, statut: 'disponible', teaser: 'Allez voir.', notesMJ: 'spoiler' },
      expe: { titre: 'Expédition', ile: 'haute', type: 'expedition', acte: 2, statut: 'en_cours', teaser: 'Loin.' },
      cachee: { titre: 'Mission cachée', ile: 'secrete', type: 'principale', acte: 2, statut: 'cachee', teaser: 'Secret.' },
    },
    ...surcharges,
  }
}
