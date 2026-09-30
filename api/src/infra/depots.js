/**
 * Accès aux tables. Toutes les requêtes SQL du portail sont ici :
 * les services ne manipulent que des objets JavaScript.
 */
export function creerDepots(db) {
  const requete = (sql) => db.prepare(sql)

  const lienDepuisLigne = (ligne) => ligne && ({ ...ligne, expireLe: ligne.expire_le, utiliseLe: ligne.utilise_le })

  return {
    utilisateurs: {
      creer: ({ identifiant, empreinteMdp, creeLe }) =>
        Number(requete('INSERT INTO utilisateurs (identifiant, empreinte_mdp, cree_le) VALUES (?, ?, ?)').run(identifiant, empreinteMdp, creeLe).lastInsertRowid),
      parId: (id) => requete('SELECT id, identifiant, empreinte_mdp, cree_le FROM utilisateurs WHERE id = ?').get(id),
      parIdentifiant: (identifiant) => requete('SELECT id, identifiant, empreinte_mdp FROM utilisateurs WHERE identifiant = ?').get(identifiant),
      changerMotDePasse: (id, empreinteMdp) => requete('UPDATE utilisateurs SET empreinte_mdp = ? WHERE id = ?').run(empreinteMdp, id),
      supprimer: (id) => requete('DELETE FROM utilisateurs WHERE id = ?').run(id),
    },

    campagnes: {
      creer: ({ nom, creeLe }) => Number(requete('INSERT INTO campagnes (nom, cree_le) VALUES (?, ?)').run(nom, creeLe).lastInsertRowid),
      parId: (id) => requete('SELECT id, nom FROM campagnes WHERE id = ?').get(id),
    },

    participations: {
      ajouter: ({ utilisateurId, campagneId, role, rejointLe }) =>
        requete('INSERT INTO participations (utilisateur_id, campagne_id, role, rejoint_le) VALUES (?, ?, ?, ?)').run(utilisateurId, campagneId, role, rejointLe),
      role: (utilisateurId, campagneId) =>
        requete('SELECT role FROM participations WHERE utilisateur_id = ? AND campagne_id = ?').get(utilisateurId, campagneId)?.role,
      campagnesDe: (utilisateurId) => requete(`
        SELECT c.id, c.nom, p.role, p.rejoint_le AS rejointLe FROM participations p JOIN campagnes c ON c.id = p.campagne_id
        WHERE p.utilisateur_id = ? ORDER BY p.rejoint_le, c.id`).all(utilisateurId),
      membresDe: (campagneId) => requete(`
        SELECT u.id, u.identifiant, p.role, p.rejoint_le AS rejointLe FROM participations p JOIN utilisateurs u ON u.id = p.utilisateur_id
        WHERE p.campagne_id = ?
        ORDER BY CASE p.role WHEN 'proprietaire' THEN 0 WHEN 'mj' THEN 1 WHEN 'joueur' THEN 2 ELSE 3 END, p.rejoint_le, u.id`).all(campagneId),
      retirer: (utilisateurId, campagneId) => requete('DELETE FROM participations WHERE utilisateur_id = ? AND campagne_id = ?').run(utilisateurId, campagneId),
    },

    invitations: {
      creer: ({ campagneId, role, empreinte, expireLe, creeLe }) =>
        requete('INSERT INTO invitations (campagne_id, role, empreinte_jeton, expire_le, cree_le) VALUES (?, ?, ?, ?, ?)').run(campagneId, role, empreinte, expireLe, creeLe),
      parEmpreinte: (empreinte) => lienDepuisLigne(requete(`
        SELECT i.id, i.campagne_id AS campagneId, i.role, i.expire_le, i.utilise_le, c.nom AS campagne
        FROM invitations i JOIN campagnes c ON c.id = i.campagne_id WHERE i.empreinte_jeton = ?`).get(empreinte)),
      marquerUtilisee: (id, le) => requete('UPDATE invitations SET utilise_le = ? WHERE id = ?').run(le, id),
    },

    reinitialisations: {
      creer: ({ utilisateurId, empreinte, expireLe, creeLe }) =>
        requete('INSERT INTO reinitialisations (utilisateur_id, empreinte_jeton, expire_le, cree_le) VALUES (?, ?, ?, ?)').run(utilisateurId, empreinte, expireLe, creeLe),
      parEmpreinte: (empreinte) => lienDepuisLigne(requete(`
        SELECT r.id, r.utilisateur_id AS utilisateurId, r.expire_le, r.utilise_le, u.identifiant
        FROM reinitialisations r JOIN utilisateurs u ON u.id = r.utilisateur_id WHERE r.empreinte_jeton = ?`).get(empreinte)),
      marquerUtilisee: (id, le) => requete('UPDATE reinitialisations SET utilise_le = ? WHERE id = ?').run(le, id),
    },

    sessions: {
      creer: ({ empreinte, utilisateurId, expireLe, creeLe }) =>
        requete('INSERT INTO sessions (empreinte_jeton, utilisateur_id, expire_le, cree_le) VALUES (?, ?, ?, ?)').run(empreinte, utilisateurId, expireLe, creeLe),
      utilisateurValide: (empreinte, maintenant) => requete(`
        SELECT u.id, u.identifiant FROM sessions s JOIN utilisateurs u ON u.id = s.utilisateur_id
        WHERE s.empreinte_jeton = ? AND s.expire_le > ?`).get(empreinte, maintenant),
      supprimer: (empreinte) => requete('DELETE FROM sessions WHERE empreinte_jeton = ?').run(empreinte),
      supprimerCellesDe: (utilisateurId) => requete('DELETE FROM sessions WHERE utilisateur_id = ?').run(utilisateurId),
      resumeDe: (utilisateurId) => requete('SELECT cree_le AS creeLe, expire_le AS expireLe FROM sessions WHERE utilisateur_id = ? ORDER BY cree_le').all(utilisateurId),
    },

    etats: {
      lire: (campagneId) => requete('SELECT contenu, version FROM etats_campagne WHERE campagne_id = ?').get(campagneId),
      /** Écrase sans condition (import en ligne de commande) et passe à la version suivante. */
      ecrire: (campagneId, contenu, majLe) => requete(`
        INSERT INTO etats_campagne (campagne_id, contenu, maj_le, version) VALUES (?, ?, ?, 1)
        ON CONFLICT (campagne_id) DO UPDATE SET contenu = excluded.contenu, maj_le = excluded.maj_le, version = version + 1`).run(campagneId, contenu, majLe),
      /** N'écrit que si la version en base est toujours celle attendue ; renvoie vrai si c'est le cas. */
      remplacerSiVersion: (campagneId, contenu, majLe, versionAttendue) => Number(requete(`
        UPDATE etats_campagne SET contenu = ?, maj_le = ?, version = version + 1
        WHERE campagne_id = ? AND version = ?`).run(contenu, majLe, campagneId, versionAttendue).changes) === 1,
    },

    /** Données périmées : les garder n'apporterait rien et le RGPD demande de ne pas conserver sans raison. */
    purger: (maintenant) => {
      const changements = [
        requete('DELETE FROM sessions WHERE expire_le <= ?').run(maintenant),
        requete('DELETE FROM invitations WHERE expire_le <= ? OR utilise_le IS NOT NULL').run(maintenant),
        requete('DELETE FROM reinitialisations WHERE expire_le <= ? OR utilise_le IS NOT NULL').run(maintenant),
        // Compte qui ne fait plus partie d'aucune campagne et dont toutes les sessions ont expiré.
        requete(`DELETE FROM utilisateurs WHERE
          NOT EXISTS (SELECT 1 FROM participations p WHERE p.utilisateur_id = utilisateurs.id)
          AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.utilisateur_id = utilisateurs.id)`).run(),
      ]
      return changements.reduce((total, c) => total + Number(c.changes), 0)
    },
  }
}
