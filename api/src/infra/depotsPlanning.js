import { CLES_CATEGORIES } from '../../../src/domain/notifications.js'

/** Accès aux tables de la planification et des notifications. */
export function creerDepotsPlanning(db) {
  const requete = (sql) => db.prepare(sql)

  return {
    sondages: {
      creer: ({ campagneId, lieu, dateLimite, creeLe }) => Number(requete(`
        INSERT INTO sondages (campagne_id, lieu, date_limite, statut, cree_le) VALUES (?, ?, ?, 'ouvert', ?)`)
        .run(campagneId, lieu, dateLimite, creeLe).lastInsertRowid),
      ajouterDate: (sondageId, jour) => requete('INSERT INTO sondage_dates (sondage_id, jour) VALUES (?, ?)').run(sondageId, jour),
      ouvertDe: (campagneId) => requete(`
        SELECT id, lieu, date_limite AS dateLimite FROM sondages WHERE campagne_id = ? AND statut = 'ouvert'`).get(campagneId),
      parId: (sondageId, campagneId) => requete(`
        SELECT id, lieu, date_limite AS dateLimite, statut FROM sondages WHERE id = ? AND campagne_id = ?`).get(sondageId, campagneId),
      dates: (sondageId) => requete('SELECT id, jour FROM sondage_dates WHERE sondage_id = ? ORDER BY jour').all(sondageId),
      changerStatut: (sondageId, statut) => requete('UPDATE sondages SET statut = ? WHERE id = ?').run(statut, sondageId),
      /** Pour les relances : les sondages ouverts de toutes les campagnes qui ont une date limite. */
      ouvertsAvecLimite: () => requete(`
        SELECT id, campagne_id AS campagneId, date_limite AS dateLimite, cree_le AS creeLe FROM sondages WHERE statut = 'ouvert' AND date_limite IS NOT NULL`).all(),
    },

    disponibilites: {
      duSondage: (sondageId) => requete(`
        SELECT d.date_id AS dateId, d.utilisateur_id AS utilisateurId, u.identifiant, d.disponible, d.debut, d.fin
        FROM disponibilites d
        JOIN sondage_dates sd ON sd.id = d.date_id
        JOIN sondages s ON s.id = sd.sondage_id
        JOIN utilisateurs u ON u.id = d.utilisateur_id
        -- Seuls les joueurs encore membres comptent : un joueur retiré disparaît du sondage.
        JOIN participations p ON p.utilisateur_id = d.utilisateur_id AND p.campagne_id = s.campagne_id AND p.role = 'joueur'
        WHERE sd.sondage_id = ? ORDER BY u.identifiant`).all(sondageId),
      /** Pour l'export RGPD : toutes les réponses données par un utilisateur. */
      de: (utilisateurId) => requete(`
        SELECT c.nom AS campagne, sd.jour, d.disponible, d.debut, d.fin, d.repondu_le AS reponduLe
        FROM disponibilites d
        JOIN sondage_dates sd ON sd.id = d.date_id
        JOIN sondages s ON s.id = sd.sondage_id
        JOIN campagnes c ON c.id = s.campagne_id
        WHERE d.utilisateur_id = ? ORDER BY sd.jour`).all(utilisateurId),
      enregistrer: ({ dateId, utilisateurId, disponible, debut, fin, reponduLe }) => requete(`
        INSERT INTO disponibilites (date_id, utilisateur_id, disponible, debut, fin, repondu_le) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (date_id, utilisateur_id) DO UPDATE SET
          disponible = excluded.disponible, debut = excluded.debut, fin = excluded.fin, repondu_le = excluded.repondu_le`)
        .run(dateId, utilisateurId, disponible ? 1 : 0, debut, fin, reponduLe),
    },

    seances: {
      creer: ({ campagneId, jour, debut, fin, lieu, fixeeLe }) => Number(requete(`
        INSERT INTO seances (campagne_id, jour, debut, fin, lieu, fixee_le) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(campagneId, jour, debut, fin, lieu, fixeeLe).lastInsertRowid),
      prochaine: (campagneId, aPartirDu) => requete(`
        SELECT id, jour, debut, fin, lieu FROM seances
        WHERE campagne_id = ? AND statut = 'prevue' AND jour >= ? ORDER BY jour, debut LIMIT 1`).get(campagneId, aPartirDu),
      parId: (seanceId, campagneId) => requete(`
        SELECT id, jour, debut, fin, lieu, statut FROM seances WHERE id = ? AND campagne_id = ?`).get(seanceId, campagneId),
      annuler: (seanceId) => requete("UPDATE seances SET statut = 'annulee' WHERE id = ?").run(seanceId),
      /** Pour les rappels : les séances prévues de toutes les campagnes, à partir d'un jour. */
      prevuesDepuis: (jour) => requete(`
        SELECT id, campagne_id AS campagneId, jour, debut, fin, lieu, fixee_le AS fixeeLe FROM seances WHERE statut = 'prevue' AND jour >= ? ORDER BY jour`).all(jour),
    },

    notifications: {
      /** Toute notification part aussi en push, aux appareils et selon les choix de chacun (voir services/push.js). */
      creer: ({ utilisateurId, campagneId, texte, lien, categorie, creeLe }) => {
        if (!CLES_CATEGORIES.includes(categorie)) throw new Error(`Catégorie de notification inconnue : ${categorie}`)
        return requete(`
          INSERT INTO notifications (utilisateur_id, campagne_id, texte, lien, categorie, push_a_envoyer, cree_le) VALUES (?, ?, ?, ?, ?, 1, ?)`)
          .run(utilisateurId, campagneId, texte, lien, categorie, creeLe)
      },
      de: (utilisateurId, limite) => requete(`
        SELECT id, campagne_id AS campagneId, texte, lien, cree_le AS creeLe, lue_le AS lueLe
        FROM notifications WHERE utilisateur_id = ? ORDER BY cree_le DESC, id DESC LIMIT ?`).all(utilisateurId, limite),
      nonLues: (utilisateurId) => requete('SELECT COUNT(*) AS n FROM notifications WHERE utilisateur_id = ? AND lue_le IS NULL').get(utilisateurId).n,
      supprimerCellesDe: (utilisateurId, campagneId) => requete('DELETE FROM notifications WHERE utilisateur_id = ? AND campagne_id = ?').run(utilisateurId, campagneId),
      marquerLues: (utilisateurId, le) => requete('UPDATE notifications SET lue_le = ? WHERE utilisateur_id = ? AND lue_le IS NULL').run(le, utilisateurId),
    },

    /** Rappels de séance et relances de sondage déjà envoyés (« seance:4:veille », « sondage:2 »). */
    rappels: {
      envoyes: (prefixe) => requete("SELECT cle FROM rappels_envoyes WHERE cle LIKE ? || '%'").all(prefixe).map((l) => l.cle),
      noter: (cle, le) => requete('INSERT INTO rappels_envoyes (cle, le) VALUES (?, ?) ON CONFLICT (cle) DO NOTHING').run(cle, le),
      purger: (avant) => requete('DELETE FROM rappels_envoyes WHERE le < ?').run(avant),
    },

    /** Réponses aux sondages et notifications devenues inutiles (voir la politique de confidentialité). */
    purger: ({ jourLimiteSondages, luesAvant, toutesAvant }) => {
      const changements = [
        requete(`DELETE FROM sondages WHERE (SELECT MAX(jour) FROM sondage_dates WHERE sondage_id = sondages.id) < ?
                 OR NOT EXISTS (SELECT 1 FROM sondage_dates WHERE sondage_id = sondages.id)`).run(jourLimiteSondages),
        requete('DELETE FROM notifications WHERE (lue_le IS NOT NULL AND lue_le < ?) OR cree_le < ?').run(luesAvant, toutesAvant),
      ]
      return changements.reduce((total, c) => total + Number(c.changes), 0)
    },
  }
}
