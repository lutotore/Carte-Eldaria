/**
 * Les rubriques de la bibliothèque : un type de fiche, ses deux pages (liste et fiche) et ses textes.
 * L'ordre est celui des onglets.
 */
export const RUBRIQUES = [
  {
    type: 'pnj', onglet: 'PNJ', titre: 'Bibliothèque', liste: 'bibliotheque', fiche: 'fiche',
    nature: 'PNJ', inconnu: 'Personnage inconnu', nouveau: 'Nouveau PNJ',
    mj: 'Tous les PNJ de la campagne. Les joueurs ne voient que ce que tu révèles.',
    joueur: 'Les personnages croisés par la Compagnie, et ce que vous savez d’eux.',
    videMj: 'Aucun PNJ pour l’instant.', videJoueur: 'Aucun personnage connu pour l’instant.',
  },
  {
    type: 'creature', onglet: 'Bestiaire', titre: 'Bestiaire', liste: 'bestiaire', fiche: 'creature',
    nature: 'Créature', inconnu: 'Créature inconnue', nouveau: 'Nouvelle créature',
    mj: 'Toutes les créatures de la campagne. Les joueurs ne voient que ce que tu révèles.',
    joueur: 'Les créatures affrontées, et ce que vous en avez appris.',
    videMj: 'Aucune créature pour l’instant.', videJoueur: 'Aucune créature connue pour l’instant.',
  },
  {
    type: 'lieu', onglet: 'Lieux', titre: 'Lieux', liste: 'lieux', fiche: 'lieu',
    nature: 'Lieu', inconnu: 'Lieu inconnu', nouveau: 'Nouveau lieu',
    mj: 'Tous les lieux de la campagne, rattachés à leur île. Les joueurs ne voient que ce que tu révèles.',
    joueur: 'Les lieux visités par la Compagnie. Ils apparaissent aussi sur la carte, dans la fiche de leur île.',
    videMj: 'Aucun lieu pour l’instant.', videJoueur: 'Aucun lieu connu pour l’instant.',
  },
  {
    type: 'document', onglet: 'Documents', titre: 'Documents', liste: 'documents', fiche: 'document',
    nature: 'Document', inconnu: 'Document sans titre', nouveau: 'Nouveau document',
    mj: 'Lettres, plans, affiches… Remets-les à un joueur ou au groupe ; le destinataire peut les partager lui-même.',
    joueur: 'Les documents trouvés ou reçus. Si on t’en confie un, à toi de décider de le montrer aux autres.',
    videMj: 'Aucun document pour l’instant.', videJoueur: 'Aucun document pour l’instant.',
  },
  {
    type: 'objet', onglet: 'Objets', titre: 'Objets', liste: 'objets', fiche: 'objet',
    nature: 'Objet', inconnu: 'Objet non identifié', nouveau: 'Nouvel objet',
    mj: 'Les objets remarquables. Révèle leurs propriétés au fil de l’identification ; une malédiction reste un secret tant que tu veux.',
    joueur: 'Les objets remarquables que vous avez examinés, et ce que vous en avez compris.',
    videMj: 'Aucun objet pour l’instant.', videJoueur: 'Aucun objet identifié pour l’instant.',
  },
]

export function rubriqueDe(type) {
  return RUBRIQUES.find((r) => r.type === type) ?? RUBRIQUES[0]
}

/** Les lieux connus, rangés par île (les lieux sans nom en dernier) ; ceux qu'on ne sait pas situer sont ignorés. */
export function lieuxParIle(fiches) {
  const index = new Map()
  for (const fiche of fiches) {
    if (!fiche.ile) continue
    if (!index.has(fiche.ile)) index.set(fiche.ile, [])
    index.get(fiche.ile).push(fiche)
  }
  const cle = (f) => f.nom ?? '￿'
  for (const lieux of index.values()) lieux.sort((a, b) => cle(a).localeCompare(cle(b), 'fr'))
  return index
}
