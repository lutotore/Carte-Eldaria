import { idDe } from '../outils.js'

export function routesCampagnes(api, portail, config) {
  const connecte = { preHandler: api.connecte }
  const contexte = (request) => ({ demandeurId: request.utilisateur.id, campagneId: idDe(request.params.id) })

  api.get('/api/campagnes/:id/monde', connecte, async (request) => portail.lireMonde(contexte(request)))

  api.get('/api/campagnes/:id/etat', connecte, async (request) => portail.lireEtat(contexte(request)))

  api.put('/api/campagnes/:id/etat', { ...connecte, bodyLimit: 5 * 1024 * 1024 }, async (request, reply) => {
    portail.ecrireEtat({ ...contexte(request), etat: request.body })
    return reply.status(204).send()
  })

  api.get('/api/campagnes/:id/membres', connecte, async (request) => portail.membres(contexte(request)))

  api.post('/api/campagnes/:id/invitations', connecte, async (request, reply) => {
    const { jeton, expireLe } = portail.creerInvitation({ ...contexte(request), role: request.body?.role })
    return reply.status(201).send({ lien: `${config.origine}/invitation/${jeton}`, expireLe })
  })

  api.delete('/api/campagnes/:id/membres/:membreId', connecte, async (request, reply) => {
    portail.retirerMembre({ ...contexte(request), cibleId: idDe(request.params.membreId) })
    return reply.status(204).send()
  })

  api.post('/api/campagnes/:id/membres/:membreId/reinitialisation', connecte, async (request, reply) => {
    const { jeton, expireLe } = portail.creerReinitialisation({ ...contexte(request), cibleId: idDe(request.params.membreId) })
    return reply.status(201).send({ lien: `${config.origine}/reinitialisation/${jeton}`, expireLe })
  })
}
