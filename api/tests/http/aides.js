import { construireApp } from '../../src/http/app.js'
import { etatExemple, MDP, portailDeTest } from '../services/aides.js'

export const ORIGINE = 'https://eldaria.exemple.fr'

/** Application HTTP complète sur base en mémoire, avec une campagne et son propriétaire « tom ». */
export async function appDeTest() {
  const outils = portailDeTest()
  const app = construireApp({ portail: outils.portail, config: { origine: ORIGINE, cookieSecurise: true, journal: false } })
  const { campagneId, jeton } = outils.portail.initialiserCampagne({ nom: 'Eldaria' })
  const reponse = await app.inject({ method: 'POST', url: `/api/invitations/${jeton}`, payload: { identifiant: 'tom', motDePasse: MDP }, headers: { origin: ORIGINE } })
  outils.portail.importerEtat(campagneId, etatExemple())
  return { ...outils, app, campagneId, cookieTom: cookieDe(reponse) }
}

export function cookieDe(reponse) {
  const brut = reponse.headers['set-cookie']
  const ligne = Array.isArray(brut) ? brut[0] : brut
  return ligne ? ligne.split(';')[0] : undefined
}

/** Requête d'un navigateur légitime : même origine, cookie de session éventuel. */
export function requete(app, { method = 'GET', url, cookie, payload, entetes = {} }) {
  const headers = { origin: ORIGINE, ...entetes }
  if (cookie) headers.cookie = cookie
  return app.inject({ method, url, headers, payload })
}

/** Invite et inscrit un membre ; renvoie son cookie de session. */
export async function inscrireParHttp(app, { campagneId, cookieProprietaire, identifiant, role }) {
  const invitation = await requete(app, { method: 'POST', url: `/api/campagnes/${campagneId}/invitations`, cookie: cookieProprietaire, payload: { role } })
  const jeton = invitation.json().lien.split('/').at(-1)
  const reponse = await requete(app, { method: 'POST', url: `/api/invitations/${jeton}`, payload: { identifiant, motDePasse: MDP } })
  return cookieDe(reponse)
}
