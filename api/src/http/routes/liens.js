import { LIMITE_TENTATIVES } from '../outils.js'

/** Pages ouvertes depuis un lien reçu : invitation et réinitialisation de mot de passe. */
export function routesLiens(api, portail) {
  api.get('/api/invitations/:jeton', async (request) => portail.decrireInvitation(request.params.jeton))

  api.post('/api/invitations/:jeton', { config: LIMITE_TENTATIVES }, async (request, reply) => {
    const { identifiant, motDePasse } = request.body ?? {}
    const connecte = portail.utilisateurDeSession(api.session.jeton(request))

    if (identifiant === undefined && connecte) {
      await portail.accepterInvitation(request.params.jeton, { utilisateurId: connecte.id })
      return portail.profil(connecte.id)
    }

    const { utilisateurId } = await portail.accepterInvitation(request.params.jeton, { identifiant, motDePasse })
    const { jeton } = await portail.connecter({ identifiant, motDePasse })
    api.session.ouvrir(reply, jeton)
    return portail.profil(utilisateurId)
  })

  api.get('/api/reinitialisations/:jeton', async (request) => portail.decrireReinitialisation(request.params.jeton))

  api.post('/api/reinitialisations/:jeton', { config: LIMITE_TENTATIVES }, async (request, reply) => {
    await portail.reinitialiser(request.params.jeton, request.body?.motDePasse)
    return reply.status(204).send()
  })
}
