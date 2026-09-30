import { LIMITE_TENTATIVES } from '../outils.js'

export function routesSession(api, portail) {
  api.post('/api/session', { config: LIMITE_TENTATIVES }, async (request, reply) => {
    const { identifiant, motDePasse } = request.body ?? {}
    const { jeton } = await portail.connecter({ identifiant, motDePasse })
    api.session.ouvrir(reply, jeton)
    const utilisateur = portail.utilisateurDeSession(jeton)
    return portail.profil(utilisateur.id)
  })

  api.delete('/api/session', async (request, reply) => {
    portail.deconnecter(api.session.jeton(request))
    api.session.fermer(reply)
    return reply.status(204).send()
  })
}
