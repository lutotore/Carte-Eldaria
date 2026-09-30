import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { ErreurMetier } from '../domaine/erreurs.js'
import { DUREES_JOURS } from '../services/portail.js'
import { routesBibliotheque } from './routes/bibliotheque.js'
import { routesCampagnes } from './routes/campagnes.js'
import { routesLiens } from './routes/liens.js'
import { routesMoi } from './routes/moi.js'
import { routesPlanning } from './routes/planning.js'
import { routesSession } from './routes/session.js'

const STATUT_PAR_CODE = {
  requete_invalide: 400,
  non_connecte: 401,
  identifiants_incorrects: 401,
  interdit: 403,
  introuvable: 404,
  lien_inconnu: 404,
  identifiant_pris: 409,
  deja_membre: 409,
  conflit: 409,
  lien_utilise: 410,
  lien_expire: 410,
  trop_de_tentatives: 429,
}

/** Les jetons d'invitation et de réinitialisation ne doivent jamais finir dans un journal. */
export function masquerJetons(url) {
  return String(url).replace(/\/(invitations|reinitialisations)\/[^/?#]+/g, '/$1/***')
}

function optionsJournal(journal) {
  if (!journal) return false
  // Ni adresse IP ni en-têtes : seulement la méthode et le chemin, jetons masqués.
  return { serializers: { req: (req) => ({ method: req.method, url: masquerJetons(req.url) }) } }
}

/**
 * @param portail  les cas d'usage (voir services/portail.js)
 * @param config   origine publique du site (https://…), cookie Secure ou non, journal activé ou non
 */
export function construireApp({ portail, config }) {
  const app = Fastify({
    logger: optionsJournal(config.journal),
    // Un seul relais de confiance, Caddy : l'IP retenue est celle qu'il a vue, jamais une valeur fournie par le client.
    trustProxy: config.derriereProxy ? 1 : false,
    bodyLimit: 64 * 1024,
  })

  // Seul le JSON est accepté : un formulaire HTML piégé sur un autre site ne peut pas en envoyer.
  app.removeContentTypeParser('text/plain')
  // Portraits envoyés bruts. Ces types déclenchent une vérification CORS : un autre site ne peut pas en envoyer.
  app.addContentTypeParser(['image/png', 'image/jpeg', 'image/webp'], { parseAs: 'buffer', bodyLimit: 6 * 1024 * 1024 },
    (request, corps, termine) => termine(null, corps))

  const session = {
    nom: config.cookieSecurise ? '__Host-eldaria_session' : 'eldaria_session',
    options: { path: '/', httpOnly: true, sameSite: 'lax', secure: Boolean(config.cookieSecurise) },
  }
  app.decorate('session', {
    ouvrir: (reply, jeton) => reply.setCookie(session.nom, jeton, { ...session.options, maxAge: DUREES_JOURS.session * 86_400 }),
    fermer: (reply) => reply.clearCookie(session.nom, session.options),
    jeton: (request) => request.cookies[session.nom],
  })
  app.decorateRequest('utilisateur', null)

  /** À placer en preHandler des routes qui exigent un compte connecté. */
  app.decorate('connecte', async (request) => {
    request.utilisateur = portail.utilisateurDeSession(app.session.jeton(request))
    if (!request.utilisateur) throw new ErreurMetier('non_connecte', 'Connecte-toi pour continuer.')
  })

  app.register(cookie)
  app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => Object.assign(
      new ErreurMetier('trop_de_tentatives', 'Trop de tentatives. Réessaie dans un quart d’heure.'),
      { statusCode: 429 },
    ),
  })

  // Protection CSRF : toute modification doit venir du portail lui-même.
  app.addHook('onRequest', async (request) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return
    const origine = request.headers.origin
    const croise = origine ? origine !== config.origine : request.headers['sec-fetch-site'] === 'cross-site'
    if (croise) throw new ErreurMetier('interdit', 'Requête refusée : elle ne vient pas du portail.')
  })

  // Les réponses de l'API sont personnelles : aucun cache ne doit les garder.
  app.addHook('onSend', async (request, reply) => {
    if (!reply.hasHeader('Cache-Control')) reply.header('Cache-Control', 'no-store')
  })

  app.setErrorHandler((erreur, request, reply) => {
    if (erreur instanceof ErreurMetier) {
      return reply.status(STATUT_PAR_CODE[erreur.code] ?? 400).send({ code: erreur.code, message: erreur.message })
    }
    if (erreur.statusCode && erreur.statusCode < 500) {
      return reply.status(erreur.statusCode).send({ code: 'requete_invalide', message: 'Requête invalide.' })
    }
    request.log.error(erreur)
    return reply.status(500).send({ code: 'erreur_serveur', message: 'Erreur inattendue du serveur. Réessaie dans un instant.' })
  })

  app.setNotFoundHandler((request, reply) => reply.status(404).send({ code: 'introuvable', message: 'Adresse inconnue.' }))

  app.get('/api/sante', async () => ({ ok: true }))
  app.register(async (api) => {
    routesSession(api, portail)
    routesMoi(api, portail)
    routesLiens(api, portail, config)
    routesCampagnes(api, portail, config)
    routesPlanning(api, portail)
    routesBibliotheque(api, portail)
  })

  return app
}
