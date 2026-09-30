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

  changerMotDePasse: (actuel, nouveau) => appeler('PUT', '/api/moi/mot-de-passe', { actuel, nouveau }),
  supprimerCompte: (motDePasse) => appeler('POST', '/api/moi/suppression', { motDePasse }),
}
