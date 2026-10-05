/** Erreur renvoyée par l'API, avec un message déjà lisible par un joueur. */
export class ErreurApi extends Error {
  constructor(statut, code, message) {
    super(message)
    this.name = 'ErreurApi'
    this.statut = statut
    this.code = code
  }
}

/**
 * Seul point de passage vers l'API. Le cookie de session suit automatiquement
 * (même domaine) ; le JavaScript n'y a jamais accès.
 */
export async function appeler(methode, chemin, corps) {
  const options = { method: methode, headers: { Accept: 'application/json' }, credentials: 'same-origin' }
  if (corps !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(corps)
  }

  let reponse
  try {
    reponse = await fetch(chemin, options)
  } catch {
    throw new ErreurApi(0, 'reseau', 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.')
  }

  const texte = await reponse.text()
  const donnees = texte ? JSON.parse(texte) : null
  if (!reponse.ok) {
    throw new ErreurApi(reponse.status, donnees?.code ?? 'inconnu', donnees?.message ?? `Erreur ${reponse.status}.`)
  }
  return donnees
}

/** Les appels du portail, un par besoin de l'interface. */
export const api = {
  moi: () => appeler('GET', '/api/moi'),
  connecter: (identifiant, motDePasse) => appeler('POST', '/api/session', { identifiant, motDePasse }),
  deconnecter: () => appeler('DELETE', '/api/session'),

  lireInvitation: (jeton) => appeler('GET', `/api/invitations/${encodeURIComponent(jeton)}`),
  accepterInvitation: (jeton, compte = {}) => appeler('POST', `/api/invitations/${encodeURIComponent(jeton)}`, compte),
  lireReinitialisation: (jeton) => appeler('GET', `/api/reinitialisations/${encodeURIComponent(jeton)}`),
  reinitialiser: (jeton, motDePasse) => appeler('POST', `/api/reinitialisations/${encodeURIComponent(jeton)}`, { motDePasse }),

  monde: (campagneId) => appeler('GET', `/api/campagnes/${campagneId}/monde`),
  /** Le monde complet et son numéro de version : { etat, version }. */
  etat: (campagneId) => appeler('GET', `/api/campagnes/${campagneId}/etat`),
  /** Refusé (409, code « conflit ») si un autre MJ a enregistré depuis la version indiquée. */
  enregistrerEtat: (campagneId, etat, version) => appeler('PUT', `/api/campagnes/${campagneId}/etat`, { etat, version }),

  membres: (campagneId) => appeler('GET', `/api/campagnes/${campagneId}/membres`),
  inviter: (campagneId, role) => appeler('POST', `/api/campagnes/${campagneId}/invitations`, { role }),
  retirerMembre: (campagneId, membreId) => appeler('DELETE', `/api/campagnes/${campagneId}/membres/${membreId}`),
  lienReinitialisation: (campagneId, membreId) => appeler('POST', `/api/campagnes/${campagneId}/membres/${membreId}/reinitialisation`),

  planning: (campagneId) => appeler('GET', `/api/campagnes/${campagneId}/planning`),
  ouvrirSondage: (campagneId, sondage) => appeler('POST', `/api/campagnes/${campagneId}/sondages`, sondage),
  repondre: (campagneId, sondageId, reponses) => appeler('PUT', `/api/campagnes/${campagneId}/sondages/${sondageId}/reponses`, { reponses }),
  fixerSeance: (campagneId, sondageId, seance) => appeler('POST', `/api/campagnes/${campagneId}/sondages/${sondageId}/seance`, seance),
  annulerSondage: (campagneId, sondageId) => appeler('DELETE', `/api/campagnes/${campagneId}/sondages/${sondageId}`),
  annulerSeance: (campagneId, seanceId) => appeler('DELETE', `/api/campagnes/${campagneId}/seances/${seanceId}`),
  notifications: () => appeler('GET', '/api/notifications'),
  marquerNotificationsLues: () => appeler('POST', '/api/notifications/lues'),

  bibliotheque: (campagneId, type = 'pnj') => appeler('GET', `/api/campagnes/${campagneId}/bibliotheque?type=${type}`),
  fiche: (campagneId, ficheId) => appeler('GET', `/api/campagnes/${campagneId}/fiches/${ficheId}`),
  creerFiche: (campagneId, nom, type = 'pnj') => appeler('POST', `/api/campagnes/${campagneId}/fiches`, { nom, type }),
  ajouterElement: (campagneId, ficheId, cle, titre, texte) => appeler('POST', `/api/campagnes/${campagneId}/fiches/${ficheId}/elements`, { cle, titre, texte }),
  changerIle: (campagneId, ficheId, ile) => appeler('PUT', `/api/campagnes/${campagneId}/fiches/${ficheId}/ile`, { ile }),
  partager: (campagneId, ficheId) => appeler('POST', `/api/campagnes/${campagneId}/fiches/${ficheId}/partage`),
  revelerTout: (campagneId, ficheId) => appeler('POST', `/api/campagnes/${campagneId}/fiches/${ficheId}/revelation-totale`),
  estimer: (campagneId, ficheId, cle, texte) => appeler('PUT', `/api/campagnes/${campagneId}/fiches/${ficheId}/estimations/${cle}`, { texte }),
  supprimerFiche: (campagneId, ficheId) => appeler('DELETE', `/api/campagnes/${campagneId}/fiches/${ficheId}`),
  modifierFacette: (campagneId, ficheId, facetteId, valeur, titre) => appeler('PUT', `/api/campagnes/${campagneId}/fiches/${ficheId}/facettes/${facetteId}`, { valeur, titre }),
  ajouterSecret: (campagneId, ficheId, titre, texte) => appeler('POST', `/api/campagnes/${campagneId}/fiches/${ficheId}/secrets`, { titre, texte }),
  supprimerSecret: (campagneId, ficheId, facetteId) => appeler('DELETE', `/api/campagnes/${campagneId}/fiches/${ficheId}/facettes/${facetteId}`),
  modifierNotesMj: (campagneId, ficheId, notesMj) => appeler('PUT', `/api/campagnes/${campagneId}/fiches/${ficheId}/notes-mj`, { notesMj }),
  reveler: (campagneId, ficheId, facetteId, pourTous, joueurs) => appeler('PUT', `/api/campagnes/${campagneId}/fiches/${ficheId}/facettes/${facetteId}/revelation`, { pourTous, joueurs }),
  urlImage: (campagneId, imageId) => `/api/campagnes/${campagneId}/images/${imageId}`,
  ajouterNote: (campagneId, ficheId, note) => appeler('POST', `/api/campagnes/${campagneId}/fiches/${ficheId}/notes`, note),
  modifierNote: (campagneId, noteId, texte, visibilite) => appeler('PUT', `/api/campagnes/${campagneId}/notes/${noteId}`, { texte, visibilite }),
  supprimerNote: (campagneId, noteId) => appeler('DELETE', `/api/campagnes/${campagneId}/notes/${noteId}`),
  compterCroyance: (campagneId, noteId, lecture) => appeler('POST', `/api/campagnes/${campagneId}/notes/${noteId}/comptage`, { lecture }),

  personnages: (campagneId) => appeler('GET', `/api/campagnes/${campagneId}/personnages`),
  creerPersonnage: (campagneId, nom) => appeler('POST', `/api/campagnes/${campagneId}/personnages`, { nom }),
  personnage: (campagneId, personnageId) => appeler('GET', `/api/campagnes/${campagneId}/personnages/${personnageId}`),
  modifierPersonnage: (campagneId, personnageId, champs) => appeler('PUT', `/api/campagnes/${campagneId}/personnages/${personnageId}`, { champs }),
  supprimerPersonnage: (campagneId, personnageId) => appeler('DELETE', `/api/campagnes/${campagneId}/personnages/${personnageId}`),
  changerBourse: (campagneId, personnageId, avant, apres) => appeler('PUT', `/api/campagnes/${campagneId}/personnages/${personnageId}/bourse`, { avant, apres }),
  ajouterLigne: (campagneId, personnageId, ligne) => appeler('POST', `/api/campagnes/${campagneId}/personnages/${personnageId}/inventaire`, ligne),
  modifierLigne: (campagneId, personnageId, ligneId, ligne) => appeler('PUT', `/api/campagnes/${campagneId}/personnages/${personnageId}/inventaire/${ligneId}`, ligne),
  supprimerLigne: (campagneId, personnageId, ligneId) => appeler('DELETE', `/api/campagnes/${campagneId}/personnages/${personnageId}/inventaire/${ligneId}`),
  ajouterMarque: (campagneId, personnageId, marque) => appeler('POST', `/api/campagnes/${campagneId}/personnages/${personnageId}/marques`, marque),
  modifierMarque: (campagneId, personnageId, marqueId, marque) => appeler('PUT', `/api/campagnes/${campagneId}/personnages/${personnageId}/marques/${marqueId}`, marque),
  supprimerMarque: (campagneId, personnageId, marqueId) => appeler('DELETE', `/api/campagnes/${campagneId}/personnages/${personnageId}/marques/${marqueId}`),

  butins: (campagneId) => appeler('GET', `/api/campagnes/${campagneId}/butins`),
  creerButin: (campagneId, butin) => appeler('POST', `/api/campagnes/${campagneId}/butins`, butin),
  modifierButin: (campagneId, butinId, butin) => appeler('PUT', `/api/campagnes/${campagneId}/butins/${butinId}`, butin),
  supprimerButin: (campagneId, butinId) => appeler('DELETE', `/api/campagnes/${campagneId}/butins/${butinId}`),
  changerStatutButin: (campagneId, butinId, statut) => appeler('PUT', `/api/campagnes/${campagneId}/butins/${butinId}/statut`, { statut }),
  ajouterObjetButin: (campagneId, butinId, objet) => appeler('POST', `/api/campagnes/${campagneId}/butins/${butinId}/objets`, objet),
  modifierObjetButin: (campagneId, butinId, objetId, objet) => appeler('PUT', `/api/campagnes/${campagneId}/butins/${butinId}/objets/${objetId}`, objet),
  supprimerObjetButin: (campagneId, butinId, objetId) => appeler('DELETE', `/api/campagnes/${campagneId}/butins/${butinId}/objets/${objetId}`),
  prendreObjet: (campagneId, butinId, objetId, quantite) => appeler('POST', `/api/campagnes/${campagneId}/butins/${butinId}/objets/${objetId}/prise`, { quantite }),
  prendrePieces: (campagneId, butinId, pieces) => appeler('POST', `/api/campagnes/${campagneId}/butins/${butinId}/pieces/prise`, { pieces }),

  calendrier: (campagneId) => appeler('GET', `/api/campagnes/${campagneId}/calendrier`),
  changerDate: (campagneId, jour) => appeler('PUT', `/api/campagnes/${campagneId}/calendrier/date`, { jour }),
  changerButoir: (campagneId, butoir) => appeler('PUT', `/api/campagnes/${campagneId}/calendrier/butoir`, butoir),
  creerEvenement: (campagneId, entree) => appeler('POST', `/api/campagnes/${campagneId}/calendrier/evenements`, entree),
  modifierEvenement: (campagneId, evenementId, entree) => appeler('PUT', `/api/campagnes/${campagneId}/calendrier/evenements/${evenementId}`, entree),
  supprimerEvenement: (campagneId, evenementId) => appeler('DELETE', `/api/campagnes/${campagneId}/calendrier/evenements/${evenementId}`),

  reglagesPush: () => appeler('GET', '/api/moi/push'),
  abonnerPush: (abonnement, appareil) => appeler('POST', '/api/moi/push', { abonnement, appareil }),
  verifierPush: (adresse) => appeler('POST', '/api/moi/push/verification', { adresse }),
  desabonnerPush: (adresse) => appeler('POST', '/api/moi/push/desabonnement', { adresse }),
  retirerAppareilPush: (appareilId) => appeler('DELETE', `/api/moi/push/appareils/${appareilId}`),
  changerPreferencesPush: (actives) => appeler('PUT', '/api/moi/push/preferences', { actives }),
  envoyerAnnonce: (campagneId, texte, destinataires) => appeler('POST', `/api/campagnes/${campagneId}/annonces`, { texte, destinataires }),

  changerMotDePasse: (actuel, nouveau) => appeler('PUT', '/api/moi/mot-de-passe', { actuel, nouveau }),
  supprimerCompte: (motDePasse) => appeler('POST', '/api/moi/suppression', { motDePasse }),
}

/**
 * Le portrait, ou le fichier d'un document, part tel quel (PNG, JPEG, WebP, et PDF pour un document) :
 * le serveur vérifie lui-même le vrai format.
 */
export async function envoyerPortrait(campagneId, ficheId, fichier, pdfAccepte = false) {
  let reponse
  try {
    reponse = await fetch(`/api/campagnes/${campagneId}/fiches/${ficheId}/portrait`, {
      method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': fichier.type, Accept: 'application/json' }, body: fichier,
    })
  } catch {
    throw new ErreurApi(0, 'reseau', 'Le serveur ne répond pas. Vérifie ta connexion et réessaie.')
  }
  const donnees = await reponse.json().catch(() => null)
  if (reponse.status === 415) throw new ErreurApi(415, 'requete_invalide', pdfAccepte ? 'Formats acceptés : PNG, JPEG, WebP ou PDF.' : 'Formats acceptés : PNG, JPEG ou WebP.')
  if (!reponse.ok) throw new ErreurApi(reponse.status, donnees?.code ?? 'inconnu', donnees?.message ?? `Erreur ${reponse.status}.`)
  return donnees
}
