/** Accès aux tables de la bibliothèque. */
export function creerDepotsBibliotheque(db) {
  const requete = (sql) => db.prepare(sql)

  return {
    fiches: {
      creer: ({ campagneId, type, creeLe }) => Number(requete('INSERT INTO fiches (campagne_id, type, cree_le) VALUES (?, ?, ?)')
        .run(campagneId, type, creeLe).lastInsertRowid),
      parId: (ficheId, campagneId) => requete('SELECT id, type, notes_mj AS notesMj, ile FROM fiches WHERE id = ? AND campagne_id = ?').get(ficheId, campagneId),
      deLaCampagne: (campagneId) => requete('SELECT id, type, notes_mj AS notesMj, ile FROM fiches WHERE campagne_id = ? ORDER BY id').all(campagneId),
      changerIle: (ficheId, ile) => requete('UPDATE fiches SET ile = ? WHERE id = ?').run(ile, ficheId),
      changerNotesMj: (ficheId, notesMj) => requete('UPDATE fiches SET notes_mj = ? WHERE id = ?').run(notesMj, ficheId),
      supprimer: (ficheId) => requete('DELETE FROM fiches WHERE id = ?').run(ficheId),
    },

    facettes: {
      creer: ({ ficheId, cle, titre = null, valeur = '', ordre }) => Number(requete(`
        INSERT INTO facettes (fiche_id, cle, titre, valeur, ordre) VALUES (?, ?, ?, ?, ?)`).run(ficheId, cle, titre, valeur, ordre).lastInsertRowid),
      /** Toutes les facettes des fiches d'une campagne, avec leurs révélations (une seule requête de chaque). */
      deLaCampagne: (campagneId) => {
        const facettes = requete(`
          SELECT f.id, f.fiche_id AS ficheId, f.cle, f.titre, f.valeur FROM facettes f
          JOIN fiches fi ON fi.id = f.fiche_id WHERE fi.campagne_id = ? ORDER BY f.fiche_id, f.ordre, f.id`).all(campagneId)
        const revelations = requete(`
          SELECT r.facette_id AS facetteId, r.utilisateur_id AS utilisateurId FROM revelations r
          JOIN facettes f ON f.id = r.facette_id JOIN fiches fi ON fi.id = f.fiche_id WHERE fi.campagne_id = ?`).all(campagneId)
        return facettes.map((f) => ({
          ...f,
          revelations: revelations.filter((r) => r.facetteId === f.id)
            .map((r) => ({ pourTous: r.utilisateurId === null, utilisateurId: r.utilisateurId })),
        }))
      },
      prochainOrdre: (ficheId) => requete('SELECT COALESCE(MAX(ordre), 0) + 1 AS n FROM facettes WHERE fiche_id = ?').get(ficheId).n,
      changer: (facetteId, valeur, titre) => requete('UPDATE facettes SET valeur = ?, titre = COALESCE(?, titre) WHERE id = ?').run(valeur, titre, facetteId),
      supprimer: (facetteId) => requete('DELETE FROM facettes WHERE id = ?').run(facetteId),
      retirerRevelationsDe: (utilisateurId, campagneId) => requete(`
        DELETE FROM revelations WHERE utilisateur_id = ? AND facette_id IN (
          SELECT f.id FROM facettes f JOIN fiches fi ON fi.id = f.fiche_id WHERE fi.campagne_id = ?)`).run(utilisateurId, campagneId),
      remplacerRevelations: (facetteId, cibles, le) => {
        requete('DELETE FROM revelations WHERE facette_id = ?').run(facetteId)
        const inserer = requete('INSERT INTO revelations (facette_id, utilisateur_id, revele_le) VALUES (?, ?, ?)')
        for (const cible of cibles) inserer.run(facetteId, cible, le)
      },
    },

    estimations: {
      deLaFiche: (ficheId) => requete(`
        SELECT e.cle, e.texte, u.identifiant AS auteur, e.maj_le AS majLe FROM estimations e
        JOIN utilisateurs u ON u.id = e.auteur_id WHERE e.fiche_id = ?`).all(ficheId),
      ecrire: ({ ficheId, cle, texte, auteurId, majLe }) => requete(`
        INSERT INTO estimations (fiche_id, cle, texte, auteur_id, maj_le) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (fiche_id, cle) DO UPDATE SET texte = excluded.texte, auteur_id = excluded.auteur_id, maj_le = excluded.maj_le`)
        .run(ficheId, cle, texte, auteurId, majLe),
      effacer: (ficheId, cle) => requete('DELETE FROM estimations WHERE fiche_id = ? AND cle = ?').run(ficheId, cle),
      /** Pour l'export RGPD. */
      de: (auteurId) => requete(`
        SELECT e.fiche_id AS ficheId, f.campagne_id AS campagneId, c.nom AS campagne, e.cle, e.texte, e.maj_le AS majLe
        FROM estimations e JOIN fiches f ON f.id = e.fiche_id JOIN campagnes c ON c.id = f.campagne_id
        WHERE e.auteur_id = ? ORDER BY e.maj_le`).all(auteurId),
    },

    images: {
      creer: ({ id, campagneId, typeMime, taille, creeLe }) => requete(`
        INSERT INTO images (id, campagne_id, type_mime, taille, cree_le) VALUES (?, ?, ?, ?, ?)`).run(id, campagneId, typeMime, taille, creeLe),
      parId: (id, campagneId) => requete('SELECT id, type_mime AS typeMime FROM images WHERE id = ? AND campagne_id = ?').get(id, campagneId),
      supprimer: (id) => requete('DELETE FROM images WHERE id = ?').run(id),
    },

    notes: {
      creer: ({ ficheId, auteurId, type, visibilite, texte, le }) => Number(requete(`
        INSERT INTO notes (fiche_id, auteur_id, type, visibilite, texte, cree_le, maj_le) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(ficheId, auteurId, type, visibilite, texte, le, le).lastInsertRowid),
      deLaFiche: (ficheId) => requete(`
        SELECT n.id, n.auteur_id AS auteurId, u.identifiant AS auteur, n.type, n.visibilite, n.texte,
               n.cree_le AS creeLe, n.maj_le AS majLe, n.lecture_comptee AS lectureComptee
        FROM notes n JOIN utilisateurs u ON u.id = n.auteur_id WHERE n.fiche_id = ? ORDER BY n.cree_le, n.id`).all(ficheId),
      nombreParFiche: (campagneId) => requete(`
        SELECT n.fiche_id AS ficheId, COUNT(*) AS n FROM notes n JOIN fiches f ON f.id = n.fiche_id
        WHERE f.campagne_id = ? GROUP BY n.fiche_id`).all(campagneId),
      parId: (noteId, campagneId) => requete(`
        SELECT n.id, n.fiche_id AS ficheId, n.auteur_id AS auteurId, n.type, n.texte, n.lecture_comptee AS lectureComptee
        FROM notes n JOIN fiches f ON f.id = n.fiche_id WHERE n.id = ? AND f.campagne_id = ?`).get(noteId, campagneId),
      changer: (noteId, texte, visibilite, le) => requete('UPDATE notes SET texte = ?, visibilite = ?, maj_le = ? WHERE id = ?').run(texte, visibilite, le, noteId),
      compter: (noteId, lecture, le) => requete('UPDATE notes SET lecture_comptee = ?, comptee_le = ? WHERE id = ?').run(lecture, le, noteId),
      supprimer: (noteId) => requete('DELETE FROM notes WHERE id = ?').run(noteId),
      /** Pour l'export RGPD. */
      de: (auteurId) => requete(`
        SELECT n.fiche_id AS ficheId, f.campagne_id AS campagneId, c.nom AS campagne, n.type, n.visibilite, n.texte, n.cree_le AS creeLe
        FROM notes n JOIN fiches f ON f.id = n.fiche_id JOIN campagnes c ON c.id = f.campagne_id
        WHERE n.auteur_id = ? ORDER BY n.cree_le`).all(auteurId),
    },
  }
}
