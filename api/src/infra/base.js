import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Migrations numérotées : la base retient la dernière appliquée (PRAGMA user_version).
 * Règle d'or : on n'édite jamais une migration publiée, on en ajoute une nouvelle à la fin.
 */
export const MIGRATIONS = [
  `
  CREATE TABLE utilisateurs (
    id            INTEGER PRIMARY KEY,
    identifiant   TEXT NOT NULL UNIQUE COLLATE NOCASE,
    empreinte_mdp TEXT NOT NULL,
    cree_le       TEXT NOT NULL
  );

  CREATE TABLE campagnes (
    id      INTEGER PRIMARY KEY,
    nom     TEXT NOT NULL,
    cree_le TEXT NOT NULL
  );

  CREATE TABLE participations (
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    campagne_id    INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    role           TEXT NOT NULL CHECK (role IN ('proprietaire', 'mj', 'joueur', 'occasionnel')),
    rejoint_le     TEXT NOT NULL,
    PRIMARY KEY (utilisateur_id, campagne_id)
  );

  CREATE TABLE invitations (
    id              INTEGER PRIMARY KEY,
    campagne_id     INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('proprietaire', 'mj', 'joueur', 'occasionnel')),
    empreinte_jeton TEXT NOT NULL UNIQUE,
    expire_le       TEXT NOT NULL,
    utilise_le      TEXT,
    cree_le         TEXT NOT NULL
  );

  CREATE TABLE reinitialisations (
    id              INTEGER PRIMARY KEY,
    utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    empreinte_jeton TEXT NOT NULL UNIQUE,
    expire_le       TEXT NOT NULL,
    utilise_le      TEXT,
    cree_le         TEXT NOT NULL
  );

  CREATE TABLE sessions (
    empreinte_jeton TEXT PRIMARY KEY,
    utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    expire_le       TEXT NOT NULL,
    cree_le         TEXT NOT NULL
  );
  CREATE INDEX sessions_par_utilisateur ON sessions (utilisateur_id);

  CREATE TABLE etats_campagne (
    campagne_id INTEGER PRIMARY KEY REFERENCES campagnes(id) ON DELETE CASCADE,
    contenu     TEXT NOT NULL,
    maj_le      TEXT NOT NULL
  );
  `,
  // 2 — verrou optimiste : chaque écriture du monde incrémente sa version.
  `
  ALTER TABLE etats_campagne ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  `,
  // 3 — planification des séances et notifications dans le portail.
  `
  CREATE TABLE sondages (
    id          INTEGER PRIMARY KEY,
    campagne_id INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    lieu        TEXT NOT NULL DEFAULT '',
    date_limite TEXT,
    statut      TEXT NOT NULL CHECK (statut IN ('ouvert', 'clos', 'annule')),
    cree_le     TEXT NOT NULL
  );
  -- Un seul sondage ouvert par campagne, garanti par la base elle-même.
  CREATE UNIQUE INDEX un_sondage_ouvert_par_campagne ON sondages (campagne_id) WHERE statut = 'ouvert';

  CREATE TABLE sondage_dates (
    id         INTEGER PRIMARY KEY,
    sondage_id INTEGER NOT NULL REFERENCES sondages(id) ON DELETE CASCADE,
    jour       TEXT NOT NULL,
    UNIQUE (sondage_id, jour)
  );

  CREATE TABLE disponibilites (
    date_id        INTEGER NOT NULL REFERENCES sondage_dates(id) ON DELETE CASCADE,
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    disponible     INTEGER NOT NULL CHECK (disponible IN (0, 1)),
    debut          INTEGER,
    fin            INTEGER,
    repondu_le     TEXT NOT NULL,
    PRIMARY KEY (date_id, utilisateur_id),
    CHECK ((disponible = 1 AND debut IS NOT NULL AND fin > debut) OR (disponible = 0 AND debut IS NULL AND fin IS NULL))
  );

  CREATE TABLE seances (
    id          INTEGER PRIMARY KEY,
    campagne_id INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    jour        TEXT NOT NULL,
    debut       INTEGER NOT NULL,
    fin         INTEGER NOT NULL CHECK (fin > debut),
    lieu        TEXT NOT NULL DEFAULT '',
    statut      TEXT NOT NULL DEFAULT 'prevue' CHECK (statut IN ('prevue', 'annulee')),
    fixee_le    TEXT NOT NULL
  );

  CREATE TABLE notifications (
    id             INTEGER PRIMARY KEY,
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    campagne_id    INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    texte          TEXT NOT NULL,
    lien           TEXT NOT NULL,
    cree_le        TEXT NOT NULL,
    lue_le         TEXT
  );
  CREATE INDEX notifications_par_utilisateur ON notifications (utilisateur_id, cree_le);
  `,
  // 4 — bibliothèque : fiches de PNJ, facettes révélées pièce par pièce, portraits, notes des joueurs.
  `
  CREATE TABLE fiches (
    id          INTEGER PRIMARY KEY,
    campagne_id INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('pnj')),
    notes_mj    TEXT NOT NULL DEFAULT '',
    cree_le     TEXT NOT NULL
  );

  CREATE TABLE facettes (
    id      INTEGER PRIMARY KEY,
    fiche_id INTEGER NOT NULL REFERENCES fiches(id) ON DELETE CASCADE,
    cle     TEXT NOT NULL,
    titre   TEXT,
    valeur  TEXT NOT NULL DEFAULT '',
    ordre   INTEGER NOT NULL
  );
  CREATE INDEX facettes_par_fiche ON facettes (fiche_id, ordre);

  -- utilisateur_id NULL : révélée à tout le groupe.
  CREATE TABLE revelations (
    facette_id     INTEGER NOT NULL REFERENCES facettes(id) ON DELETE CASCADE,
    utilisateur_id INTEGER REFERENCES utilisateurs(id) ON DELETE CASCADE,
    revele_le      TEXT NOT NULL
  );
  CREATE UNIQUE INDEX une_revelation_par_cible ON revelations (facette_id, COALESCE(utilisateur_id, 0));

  CREATE TABLE images (
    id          TEXT PRIMARY KEY,
    campagne_id INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    type_mime   TEXT NOT NULL,
    taille      INTEGER NOT NULL,
    cree_le     TEXT NOT NULL
  );

  CREATE TABLE notes (
    id              INTEGER PRIMARY KEY,
    fiche_id        INTEGER NOT NULL REFERENCES fiches(id) ON DELETE CASCADE,
    auteur_id       INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('note', 'croyance')),
    visibilite      TEXT NOT NULL CHECK (visibilite IN ('privee', 'groupe')),
    texte           TEXT NOT NULL,
    cree_le         TEXT NOT NULL,
    maj_le          TEXT NOT NULL,
    lecture_comptee TEXT,
    comptee_le      TEXT
  );
  CREATE INDEX notes_par_fiche ON notes (fiche_id, cree_le);
  `,
  // 5 — bestiaire : les fiches peuvent être des créatures, et les joueurs estiment leurs statistiques.
  // SQLite ne sait pas modifier une contrainte CHECK : on reconstruit la table (clés étrangères suspendues le temps de l'opération).
  {
    sansClesEtrangeres: true,
    tablesAVerifier: ['fiches', 'facettes', 'notes', 'estimations'],
    sql: `
    CREATE TABLE fiches_v5 (
      id          INTEGER PRIMARY KEY,
      campagne_id INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK (type IN ('pnj', 'creature')),
      notes_mj    TEXT NOT NULL DEFAULT '',
      cree_le     TEXT NOT NULL
    );
    INSERT INTO fiches_v5 (id, campagne_id, type, notes_mj, cree_le) SELECT id, campagne_id, type, notes_mj, cree_le FROM fiches;
    DROP TABLE fiches;
    ALTER TABLE fiches_v5 RENAME TO fiches;

    -- Une estimation partagée par le groupe, par statistique de créature.
    CREATE TABLE estimations (
      fiche_id  INTEGER NOT NULL REFERENCES fiches(id) ON DELETE CASCADE,
      cle       TEXT NOT NULL,
      texte     TEXT NOT NULL,
      auteur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
      maj_le    TEXT NOT NULL,
      PRIMARY KEY (fiche_id, cle)
    );
    `,
  },
  // 6 — lieux (rattachés à une île de la carte), documents à remettre aux joueurs, objets.
  {
    sansClesEtrangeres: true,
    tablesAVerifier: ['fiches', 'facettes', 'notes', 'estimations'],
    sql: `
    CREATE TABLE fiches_v6 (
      id          INTEGER PRIMARY KEY,
      campagne_id INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK (type IN ('pnj', 'creature', 'lieu', 'document', 'objet')),
      notes_mj    TEXT NOT NULL DEFAULT '',
      ile         TEXT,
      cree_le     TEXT NOT NULL
    );
    INSERT INTO fiches_v6 (id, campagne_id, type, notes_mj, cree_le) SELECT id, campagne_id, type, notes_mj, cree_le FROM fiches;
    DROP TABLE fiches;
    ALTER TABLE fiches_v6 RENAME TO fiches;
    `,
  },
  // 7 — fiches de personnage (une par joueur et par campagne), inventaire, Marques du Rêve, butins de rencontre.
  `
  CREATE TABLE personnages (
    id             INTEGER PRIMARY KEY,
    campagne_id    INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    contenu        TEXT NOT NULL,
    pp INTEGER NOT NULL DEFAULT 0 CHECK (pp >= 0),
    po INTEGER NOT NULL DEFAULT 0 CHECK (po >= 0),
    pe INTEGER NOT NULL DEFAULT 0 CHECK (pe >= 0),
    pa INTEGER NOT NULL DEFAULT 0 CHECK (pa >= 0),
    pc INTEGER NOT NULL DEFAULT 0 CHECK (pc >= 0),
    cree_le        TEXT NOT NULL,
    maj_le         TEXT NOT NULL,
    UNIQUE (campagne_id, utilisateur_id)
  );

  CREATE TABLE inventaire (
    id             INTEGER PRIMARY KEY,
    personnage_id  INTEGER NOT NULL REFERENCES personnages(id) ON DELETE CASCADE,
    libelle        TEXT NOT NULL,
    quantite       INTEGER NOT NULL CHECK (quantite BETWEEN 1 AND 9999),
    notes          TEXT NOT NULL DEFAULT '',
    -- L'objet de la bibliothèque, quand la ligne en vient : son identification se révèle peu à peu.
    fiche_id       INTEGER REFERENCES fiches(id) ON DELETE SET NULL,
    cree_le        TEXT NOT NULL
  );
  CREATE INDEX inventaire_personnage ON inventaire (personnage_id);

  CREATE TABLE marques (
    id            INTEGER PRIMARY KEY,
    personnage_id INTEGER NOT NULL REFERENCES personnages(id) ON DELETE CASCADE,
    titre         TEXT NOT NULL,
    don           TEXT NOT NULL DEFAULT '',
    prix          TEXT NOT NULL DEFAULT '',
    cree_le       TEXT NOT NULL
  );

  CREATE TABLE butins (
    id          INTEGER PRIMARY KEY,
    campagne_id INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    titre       TEXT NOT NULL,
    notes_mj    TEXT NOT NULL DEFAULT '',
    statut      TEXT NOT NULL DEFAULT 'prepare' CHECK (statut IN ('prepare', 'ouvert', 'clos')),
    pp INTEGER NOT NULL DEFAULT 0 CHECK (pp >= 0),
    po INTEGER NOT NULL DEFAULT 0 CHECK (po >= 0),
    pe INTEGER NOT NULL DEFAULT 0 CHECK (pe >= 0),
    pa INTEGER NOT NULL DEFAULT 0 CHECK (pa >= 0),
    pc INTEGER NOT NULL DEFAULT 0 CHECK (pc >= 0),
    cree_le     TEXT NOT NULL
  );

  CREATE TABLE butin_objets (
    id          INTEGER PRIMARY KEY,
    butin_id    INTEGER NOT NULL REFERENCES butins(id) ON DELETE CASCADE,
    libelle     TEXT NOT NULL,
    quantite    INTEGER NOT NULL CHECK (quantite >= 0),
    description TEXT NOT NULL DEFAULT '',
    fiche_id    INTEGER REFERENCES fiches(id) ON DELETE SET NULL
  );

  -- Qui a pris quoi : visible de la table, et dans l'export des données du joueur.
  CREATE TABLE butin_prises (
    id             INTEGER PRIMARY KEY,
    butin_id       INTEGER NOT NULL REFERENCES butins(id) ON DELETE CASCADE,
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    texte          TEXT NOT NULL,
    le             TEXT NOT NULL
  );
  `,
  // 8 — calendrier du monde : date du jour en jeu, date butoir secrète, fêtes, événements, chronique, notes des joueurs.
  `
  CREATE TABLE calendriers (
    campagne_id    INTEGER PRIMARY KEY REFERENCES campagnes(id) ON DELETE CASCADE,
    -- Bornes : voir JOUR_MAX dans src/domain/calendrier.js (an 99 999).
    aujourdhui     INTEGER NOT NULL CHECK (aujourdhui BETWEEN 0 AND 36499999),
    butoir         INTEGER CHECK (butoir BETWEEN 0 AND 36499999),
    butoir_libelle TEXT NOT NULL DEFAULT 'La catastrophe',
    butoir_revele  INTEGER NOT NULL DEFAULT 0 CHECK (butoir_revele IN (0, 1)),
    maj_le         TEXT NOT NULL
  );

  CREATE TABLE evenements (
    id          INTEGER PRIMARY KEY,
    campagne_id INTEGER NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('fete', 'evenement', 'chronique', 'note')),
    jour        INTEGER NOT NULL CHECK (jour BETWEEN 0 AND 36499999),
    duree       INTEGER NOT NULL DEFAULT 1 CHECK (duree BETWEEN 1 AND 365),
    annuel      INTEGER NOT NULL DEFAULT 0 CHECK (annuel IN (0, 1)),
    titre       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    visibilite  TEXT NOT NULL CHECK (visibilite IN ('cache', 'groupe', 'privee')),
    -- L'auteur d'une note de joueur ; les fêtes, événements et chroniques du MJ n'en ont pas.
    auteur_id   INTEGER REFERENCES utilisateurs(id) ON DELETE CASCADE,
    cree_le     TEXT NOT NULL,
    maj_le      TEXT NOT NULL,
    CHECK ((type = 'note') = (auteur_id IS NOT NULL))
  );
  CREATE INDEX evenements_campagne ON evenements (campagne_id, jour);
  `,
]

export function ouvrirBase(chemin) {
  if (chemin !== ':memory:') mkdirSync(dirname(chemin), { recursive: true })
  const db = new DatabaseSync(chemin)
  db.exec('PRAGMA foreign_keys = ON')
  if (chemin !== ':memory:') {
    // WAL : les lectures ne bloquent pas l'écriture. busy_timeout : patiente au lieu d'échouer.
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA busy_timeout = 5000')
  }
  migrer(db)
  return db
}

function migrer(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version
  for (let i = version; i < MIGRATIONS.length; i += 1) {
    const migration = typeof MIGRATIONS[i] === 'string' ? { sql: MIGRATIONS[i] } : MIGRATIONS[i]
    // PRAGMA foreign_keys n'a d'effet qu'en dehors d'une transaction.
    if (migration.sansClesEtrangeres) db.exec('PRAGMA foreign_keys = OFF')
    try {
      transaction(db, () => {
        db.exec(migration.sql)
        if (migration.sansClesEtrangeres) {
          // Contrôle limité aux tables touchées : une vieille incohérence ailleurs ne bloque pas le démarrage.
          const orphelins = migration.tablesAVerifier.flatMap((table) => db.prepare(`PRAGMA foreign_key_check(${table})`).all())
          if (orphelins.length) throw new Error(`Migration ${i + 1} : ${orphelins.length} référence(s) cassée(s).`)
        }
        db.exec(`PRAGMA user_version = ${i + 1}`)
      })
    } finally {
      if (migration.sansClesEtrangeres) db.exec('PRAGMA foreign_keys = ON')
    }
  }
}

/** Exécute `travail` d'un bloc : tout est écrit, ou rien. */
export function transaction(db, travail) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const resultat = travail()
    db.exec('COMMIT')
    return resultat
  } catch (erreur) {
    db.exec('ROLLBACK')
    throw erreur
  }
}
