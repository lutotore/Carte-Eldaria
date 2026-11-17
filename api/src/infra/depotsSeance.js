/** Accès aux scènes préparées du pupitre de séance. */
export function creerDepotsSeance(db) {
  const requete = (sql) => db.prepare(sql)
  const lire = (ligne) => ligne && { ...ligne, elements: JSON.parse(ligne.elements) }
  const COLONNES = 'id, ordre, titre, sous_titre AS sousTitre, suite, elements, butin_id AS butinId'

  return {
    scenes: {
      deLaCampagne: (campagneId) => requete(`SELECT ${COLONNES} FROM scenes WHERE campagne_id = ? ORDER BY ordre, id`).all(campagneId).map(lire),
      parId: (sceneId, campagneId) => lire(requete(`SELECT ${COLONNES} FROM scenes WHERE id = ? AND campagne_id = ?`).get(sceneId, campagneId)),
      creer: ({ campagneId, ordre, titre, sousTitre, suite, elements, butinId, creeLe }) => Number(requete(`
        INSERT INTO scenes (campagne_id, ordre, titre, sous_titre, suite, elements, butin_id, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(campagneId, ordre, titre, sousTitre, suite, JSON.stringify(elements), butinId, creeLe).lastInsertRowid),
      viderLaCampagne: (campagneId) => requete('DELETE FROM scenes WHERE campagne_id = ?').run(campagneId),
    },
  }
}
