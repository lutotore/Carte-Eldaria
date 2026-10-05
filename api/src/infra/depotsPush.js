/** Accès aux tables des notifications push : réglages du serveur, abonnements, choix de chacun, file d'envoi. */
export function creerDepotsPush(db) {
  const requete = (sql) => db.prepare(sql)
  const COLONNES = `id, utilisateur_id AS utilisateurId, adresse, cle_p256dh AS p256dh, cle_auth AS auth, appareil,
    cree_le AS creeLe, dernier_envoi_le AS dernierEnvoiLe`

  return {
    reglages: {
      lire: (cle) => requete('SELECT valeur FROM reglages WHERE cle = ?').get(cle)?.valeur ?? null,
      ecrireSiAbsent: (cle, valeur) => requete('INSERT INTO reglages (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO NOTHING').run(cle, valeur),
    },

    abonnements: {
      /** Un navigateur déjà abonné passe au compte qui s'abonne, avec ses nouvelles clés. */
      enregistrer: ({ utilisateurId, adresse, p256dh, auth, appareil, le }) => requete(`
        INSERT INTO abonnements_push (utilisateur_id, adresse, cle_p256dh, cle_auth, appareil, cree_le) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (adresse) DO UPDATE SET utilisateur_id = excluded.utilisateur_id, cle_p256dh = excluded.cle_p256dh,
          cle_auth = excluded.cle_auth, appareil = excluded.appareil, cree_le = excluded.cree_le`)
        .run(utilisateurId, adresse, p256dh, auth, appareil, le),
      de: (utilisateurId) => requete(`SELECT ${COLONNES} FROM abonnements_push WHERE utilisateur_id = ? ORDER BY cree_le, id`).all(utilisateurId),
      garderLesPlusRecents: (utilisateurId, nombre) => requete(`
        DELETE FROM abonnements_push WHERE utilisateur_id = ? AND id NOT IN (
          SELECT id FROM abonnements_push WHERE utilisateur_id = ? ORDER BY cree_le DESC, id DESC LIMIT ?)`).run(utilisateurId, utilisateurId, nombre),
      supprimer: (id, utilisateurId) => Number(requete('DELETE FROM abonnements_push WHERE id = ? AND utilisateur_id = ?').run(id, utilisateurId).changes) === 1,
      supprimerParAdresse: (utilisateurId, adresse) => requete('DELETE FROM abonnements_push WHERE utilisateur_id = ? AND adresse = ?').run(utilisateurId, adresse),
      noterEnvoi: (id, le) => requete('UPDATE abonnements_push SET dernier_envoi_le = ? WHERE id = ?').run(le, id),
    },

    preferences: {
      coupees: (utilisateurId) => requete('SELECT categorie FROM preferences_push WHERE utilisateur_id = ?').all(utilisateurId).map((l) => l.categorie),
      remplacer: (utilisateurId, coupees) => {
        requete('DELETE FROM preferences_push WHERE utilisateur_id = ?').run(utilisateurId)
        for (const categorie of coupees) requete('INSERT INTO preferences_push (utilisateur_id, categorie) VALUES (?, ?)').run(utilisateurId, categorie)
      },
    },

    file: {
      /** Les prochaines notifications à pousser, aussitôt marquées comme traitées. */
      prendre: (nombre) => {
        const lignes = requete(`
          SELECT n.id, n.utilisateur_id AS utilisateurId, n.texte, n.lien, n.categorie, c.nom AS campagne
          FROM notifications n JOIN campagnes c ON c.id = n.campagne_id
          WHERE n.push_a_envoyer = 1 ORDER BY n.id LIMIT ?`).all(nombre)
        const marquer = requete('UPDATE notifications SET push_a_envoyer = 0 WHERE id = ?')
        for (const ligne of lignes) marquer.run(ligne.id)
        return lignes
      },
    },
  }
}
