/** Accès aux tables du calendrier du monde. */
export function creerDepotsCalendrier(db) {
  const requete = (sql) => db.prepare(sql)
  const COLONNES = `e.id, e.type, e.jour, e.duree, e.annuel, e.titre, e.description, e.visibilite,
    e.auteur_id AS auteurId, u.identifiant AS auteur, e.cree_le AS creeLe, e.maj_le AS majLe`
  const lireEvenement = (ligne) => ligne && ({ ...ligne, annuel: ligne.annuel === 1 })

  return {
    calendriers: {
      lire: (campagneId) => {
        const ligne = requete(`
          SELECT aujourdhui, butoir, butoir_libelle AS butoirLibelle, butoir_revele AS butoirRevele
          FROM calendriers WHERE campagne_id = ?`).get(campagneId)
        return ligne && { ...ligne, butoirRevele: ligne.butoirRevele === 1 }
      },
      creer: (campagneId, aujourdhui, le) => requete(`
        INSERT INTO calendriers (campagne_id, aujourdhui, maj_le) VALUES (?, ?, ?)`).run(campagneId, aujourdhui, le),
      changerDate: (campagneId, aujourdhui, le) => requete('UPDATE calendriers SET aujourdhui = ?, maj_le = ? WHERE campagne_id = ?').run(aujourdhui, le, campagneId),
      changerButoir: (campagneId, { jour, libelle, revele }, le) => requete(`
        UPDATE calendriers SET butoir = ?, butoir_libelle = ?, butoir_revele = ?, maj_le = ? WHERE campagne_id = ?`)
        .run(jour, libelle, revele ? 1 : 0, le, campagneId),
    },

    evenements: {
      creer: ({ campagneId, type, jour, duree, annuel, titre, description, visibilite, auteurId = null, le }) => Number(requete(`
        INSERT INTO evenements (campagne_id, type, jour, duree, annuel, titre, description, visibilite, auteur_id, cree_le, maj_le)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(campagneId, type, jour, duree, annuel ? 1 : 0, titre, description, visibilite, auteurId, le, le).lastInsertRowid),
      deLaCampagne: (campagneId) => requete(`
        SELECT ${COLONNES} FROM evenements e LEFT JOIN utilisateurs u ON u.id = e.auteur_id
        WHERE e.campagne_id = ? ORDER BY e.jour, e.id`).all(campagneId).map(lireEvenement),
      parId: (id, campagneId) => lireEvenement(requete(`
        SELECT ${COLONNES} FROM evenements e LEFT JOIN utilisateurs u ON u.id = e.auteur_id
        WHERE e.id = ? AND e.campagne_id = ?`).get(id, campagneId)),
      modifier: (id, { type, jour, duree, annuel, titre, description, visibilite }, le) => requete(`
        UPDATE evenements SET type = ?, jour = ?, duree = ?, annuel = ?, titre = ?, description = ?, visibilite = ?, maj_le = ? WHERE id = ?`)
        .run(type, jour, duree, annuel ? 1 : 0, titre, description, visibilite, le, id),
      supprimer: (id) => requete('DELETE FROM evenements WHERE id = ?').run(id),
      supprimerNotesDe: (auteurId, campagneId) => requete('DELETE FROM evenements WHERE auteur_id = ? AND campagne_id = ?').run(auteurId, campagneId),
      /** Pour l'export RGPD. */
      notesDe: (auteurId) => requete(`
        SELECT c.nom AS campagne, e.jour, e.titre, e.description, e.visibilite, e.cree_le AS creeLe
        FROM evenements e JOIN campagnes c ON c.id = e.campagne_id WHERE e.auteur_id = ? ORDER BY e.jour, e.id`).all(auteurId),
    },
  }
}
