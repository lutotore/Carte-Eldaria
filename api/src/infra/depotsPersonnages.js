/** Accès aux tables des fiches de personnage, de l'inventaire, des Marques du Rêve et des butins. */
const PIECES = ['pp', 'po', 'pe', 'pa', 'pc']
const COLONNES_PIECES = PIECES.join(', ')
const bourseDe = (ligne) => Object.fromEntries(PIECES.map((p) => [p, ligne[p]]))

export function creerDepotsPersonnages(db) {
  const requete = (sql) => db.prepare(sql)
  const lirePersonnage = (ligne) => ligne && ({
    id: ligne.id, campagneId: ligne.campagne_id, utilisateurId: ligne.utilisateur_id, joueur: ligne.identifiant,
    fiche: JSON.parse(ligne.contenu), bourse: bourseDe(ligne), creeLe: ligne.cree_le, majLe: ligne.maj_le,
  })
  const SELECT_PERSONNAGE = `
    SELECT p.*, u.identifiant FROM personnages p JOIN utilisateurs u ON u.id = p.utilisateur_id`
  const lireButin = (ligne) => ligne && ({
    id: ligne.id, campagneId: ligne.campagne_id, titre: ligne.titre, notesMj: ligne.notes_mj, statut: ligne.statut,
    pieces: bourseDe(ligne), creeLe: ligne.cree_le,
  })

  return {
    personnages: {
      creer: ({ campagneId, utilisateurId, fiche, le }) => Number(requete(`
        INSERT INTO personnages (campagne_id, utilisateur_id, contenu, cree_le, maj_le) VALUES (?, ?, ?, ?, ?)`)
        .run(campagneId, utilisateurId, JSON.stringify(fiche), le, le).lastInsertRowid),
      parId: (id, campagneId) => lirePersonnage(requete(`${SELECT_PERSONNAGE} WHERE p.id = ? AND p.campagne_id = ?`).get(id, campagneId)),
      de: (utilisateurId, campagneId) => lirePersonnage(requete(`${SELECT_PERSONNAGE} WHERE p.utilisateur_id = ? AND p.campagne_id = ?`).get(utilisateurId, campagneId)),
      deLaCampagne: (campagneId) => requete(`${SELECT_PERSONNAGE} WHERE p.campagne_id = ? ORDER BY u.identifiant`).all(campagneId).map(lirePersonnage),
      /** Pour l'export RGPD. */
      duJoueur: (utilisateurId) => requete(`
        SELECT p.*, u.identifiant, c.nom AS campagne FROM personnages p
        JOIN utilisateurs u ON u.id = p.utilisateur_id JOIN campagnes c ON c.id = p.campagne_id
        WHERE p.utilisateur_id = ? ORDER BY c.nom`).all(utilisateurId).map((l) => ({ ...lirePersonnage(l), campagne: l.campagne })),
      ecrireFiche: (id, fiche, le) => requete('UPDATE personnages SET contenu = ?, maj_le = ? WHERE id = ?').run(JSON.stringify(fiche), le, id),
      /** Ne change la bourse que si elle contient toujours `avant` : une prise faite entre-temps n'est pas écrasée. */
      changerBourseSi: (id, avant, apres, le) => Number(requete(`
        UPDATE personnages SET pp = ?, po = ?, pe = ?, pa = ?, pc = ?, maj_le = ?
        WHERE id = ? AND pp = ? AND po = ? AND pe = ? AND pa = ? AND pc = ?`)
        .run(...PIECES.map((p) => apres[p]), le, id, ...PIECES.map((p) => avant[p])).changes) === 1,
      ajouterPieces: (id, pieces, le) => requete(`
        UPDATE personnages SET pp = pp + ?, po = po + ?, pe = pe + ?, pa = pa + ?, pc = pc + ?, maj_le = ? WHERE id = ?`)
        .run(...PIECES.map((p) => pieces[p]), le, id),
      supprimer: (id) => requete('DELETE FROM personnages WHERE id = ?').run(id),
      supprimerCeluiDe: (utilisateurId, campagneId) => requete('DELETE FROM personnages WHERE utilisateur_id = ? AND campagne_id = ?').run(utilisateurId, campagneId),
    },

    inventaire: {
      creer: ({ personnageId, libelle, quantite, notes, ficheId = null, le }) => Number(requete(`
        INSERT INTO inventaire (personnage_id, libelle, quantite, notes, fiche_id, cree_le) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(personnageId, libelle, quantite, notes, ficheId, le).lastInsertRowid),
      du: (personnageId) => requete(`
        SELECT id, libelle, quantite, notes, fiche_id AS ficheId FROM inventaire WHERE personnage_id = ? ORDER BY id`).all(personnageId),
      parId: (id, personnageId) => requete(`
        SELECT id, libelle, quantite, notes, fiche_id AS ficheId FROM inventaire WHERE id = ? AND personnage_id = ?`).get(id, personnageId),
      /** La ligne où ranger un objet identique (même libellé, même fiche) et où il reste de la place, s'il y en a une. */
      semblable: (personnageId, libelle, ficheId, quantite) => requete(`
        SELECT id FROM inventaire WHERE personnage_id = ? AND libelle = ? AND fiche_id IS ? AND quantite + ? <= 9999
        ORDER BY id LIMIT 1`).get(personnageId, libelle, ficheId, quantite),
      ajouterQuantite: (id, quantite) => requete('UPDATE inventaire SET quantite = quantite + ? WHERE id = ?').run(quantite, id),
      modifier: (id, { libelle, quantite, notes }) => requete('UPDATE inventaire SET libelle = ?, quantite = ?, notes = ? WHERE id = ?').run(libelle, quantite, notes, id),
      supprimer: (id) => requete('DELETE FROM inventaire WHERE id = ?').run(id),
    },

    marques: {
      creer: ({ personnageId, titre, don, prix, le }) => Number(requete(`
        INSERT INTO marques (personnage_id, titre, don, prix, cree_le) VALUES (?, ?, ?, ?, ?)`).run(personnageId, titre, don, prix, le).lastInsertRowid),
      du: (personnageId) => requete(`
        SELECT id, titre, don, prix, cree_le AS creeLe FROM marques WHERE personnage_id = ? ORDER BY cree_le, id`).all(personnageId),
      parId: (id, personnageId) => requete('SELECT id FROM marques WHERE id = ? AND personnage_id = ?').get(id, personnageId),
      modifier: (id, { titre, don, prix }) => requete('UPDATE marques SET titre = ?, don = ?, prix = ? WHERE id = ?').run(titre, don, prix, id),
      supprimer: (id) => requete('DELETE FROM marques WHERE id = ?').run(id),
    },

    butins: {
      creer: ({ campagneId, titre, notesMj, pieces, le }) => Number(requete(`
        INSERT INTO butins (campagne_id, titre, notes_mj, ${COLONNES_PIECES}, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(campagneId, titre, notesMj, ...PIECES.map((p) => pieces[p]), le).lastInsertRowid),
      parId: (id, campagneId) => lireButin(requete('SELECT * FROM butins WHERE id = ? AND campagne_id = ?').get(id, campagneId)),
      deLaCampagne: (campagneId) => requete('SELECT * FROM butins WHERE campagne_id = ? ORDER BY cree_le, id').all(campagneId).map(lireButin),
      modifier: (id, { titre, notesMj, pieces }) => requete(`
        UPDATE butins SET titre = ?, notes_mj = ?, pp = ?, po = ?, pe = ?, pa = ?, pc = ? WHERE id = ?`)
        .run(titre, notesMj, ...PIECES.map((p) => pieces[p]), id),
      changerStatut: (id, statut) => requete('UPDATE butins SET statut = ? WHERE id = ?').run(statut, id),
      retirerPieces: (id, pieces) => requete(`
        UPDATE butins SET pp = pp - ?, po = po - ?, pe = pe - ?, pa = pa - ?, pc = pc - ? WHERE id = ?`)
        .run(...PIECES.map((p) => pieces[p]), id),
      supprimer: (id) => requete('DELETE FROM butins WHERE id = ?').run(id),
    },

    objetsButin: {
      creer: ({ butinId, libelle, quantite, description, ficheId = null }) => Number(requete(`
        INSERT INTO butin_objets (butin_id, libelle, quantite, description, fiche_id) VALUES (?, ?, ?, ?, ?)`)
        .run(butinId, libelle, quantite, description, ficheId).lastInsertRowid),
      du: (butinId) => requete(`
        SELECT id, libelle, quantite, description, fiche_id AS ficheId FROM butin_objets WHERE butin_id = ? ORDER BY id`).all(butinId),
      parId: (id, butinId) => requete(`
        SELECT id, libelle, quantite, description, fiche_id AS ficheId FROM butin_objets WHERE id = ? AND butin_id = ?`).get(id, butinId),
      modifier: (id, { libelle, quantite, description, ficheId = null }) => requete(`
        UPDATE butin_objets SET libelle = ?, quantite = ?, description = ?, fiche_id = ? WHERE id = ?`).run(libelle, quantite, description, ficheId, id),
      retirer: (id, quantite) => requete('UPDATE butin_objets SET quantite = quantite - ? WHERE id = ?').run(quantite, id),
      supprimer: (id) => requete('DELETE FROM butin_objets WHERE id = ?').run(id),
    },

    prises: {
      creer: ({ butinId, utilisateurId, texte, le }) => requete(`
        INSERT INTO butin_prises (butin_id, utilisateur_id, texte, le) VALUES (?, ?, ?, ?)`).run(butinId, utilisateurId, texte, le),
      du: (butinId) => requete('SELECT texte, le FROM butin_prises WHERE butin_id = ? ORDER BY le, id').all(butinId),
      /** Pour l'export RGPD. */
      de: (utilisateurId) => requete(`
        SELECT c.nom AS campagne, b.titre AS butin, p.texte, p.le FROM butin_prises p
        JOIN butins b ON b.id = p.butin_id JOIN campagnes c ON c.id = b.campagne_id
        WHERE p.utilisateur_id = ? ORDER BY p.le, p.id`).all(utilisateurId),
    },
  }
}
