import { LIMITE_TENTATIVES } from '../outils.js'

export function routesMoi(api, portail) {
  const connecte = { preHandler: api.connecte }
  // Ces deux formulaires vérifient le mot de passe actuel : même limite que la connexion.
  const connecteEtLimite = { ...connecte, config: LIMITE_TENTATIVES }

  api.get('/api/moi', connecte, async (request) => portail.profil(request.utilisateur.id))

  api.put('/api/moi/mot-de-passe', connecteEtLimite, async (request, reply) => {
    const { actuel, nouveau } = request.body ?? {}
    await portail.changerMotDePasse({ utilisateurId: request.utilisateur.id, actuel, nouveau, jetonConserve: api.session.jeton(request) })
    return reply.status(204).send()
  })

  api.get('/api/moi/export', connecte, async (request, reply) => {
    reply.header('Content-Disposition', 'attachment; filename="eldaria-mes-donnees.json"')
    return portail.exporterDonnees(request.utilisateur.id)
  })

  api.post('/api/moi/suppression', connecteEtLimite, async (request, reply) => {
    await portail.supprimerCompte({ utilisateurId: request.utilisateur.id, motDePasse: request.body?.motDePasse })
    api.session.fermer(reply)
    return reply.status(204).send()
  })
}
