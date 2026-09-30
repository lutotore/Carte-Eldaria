import { idDe } from '../outils.js'

export function routesPlanning(api, portail) {
  const connecte = { preHandler: api.connecte }
  const contexte = (request) => ({ demandeurId: request.utilisateur.id, campagneId: idDe(request.params.id) })
  const sondage = (request) => ({ ...contexte(request), sondageId: idDe(request.params.sondageId) })

  api.get('/api/campagnes/:id/planning', connecte, async (request) => portail.planning(contexte(request)))

  api.post('/api/campagnes/:id/sondages', connecte, async (request, reply) => {
    const { dates, lieu, dateLimite } = request.body ?? {}
    return reply.status(201).send(portail.ouvrirSondage({ ...contexte(request), dates, lieu, dateLimite }))
  })

  api.put('/api/campagnes/:id/sondages/:sondageId/reponses', connecte, async (request, reply) => {
    portail.repondre({ ...sondage(request), reponses: request.body?.reponses })
    return reply.status(204).send()
  })

  api.post('/api/campagnes/:id/sondages/:sondageId/seance', connecte, async (request, reply) => {
    const { dateId, debut, fin, lieu } = request.body ?? {}
    return reply.status(201).send(portail.fixerSeance({ ...sondage(request), dateId, debut, fin, lieu }))
  })

  api.delete('/api/campagnes/:id/sondages/:sondageId', connecte, async (request, reply) => {
    portail.annulerSondage(sondage(request))
    return reply.status(204).send()
  })

  api.delete('/api/campagnes/:id/seances/:seanceId', connecte, async (request, reply) => {
    portail.annulerSeance({ ...contexte(request), seanceId: idDe(request.params.seanceId) })
    return reply.status(204).send()
  })

  api.get('/api/notifications', connecte, async (request) => portail.notifications({ demandeurId: request.utilisateur.id }))

  api.post('/api/notifications/lues', connecte, async (request, reply) => {
    portail.marquerNotificationsLues({ demandeurId: request.utilisateur.id })
    return reply.status(204).send()
  })
}
