import { idDe } from '../outils.js'

/** Calendrier du monde. Les champs du corps sont repris un par un, jamais le demandeur ni la campagne. */
export function routesCalendrier(api, portail) {
  const connecte = { preHandler: api.connecte }
  const contexte = (request) => ({ demandeurId: request.utilisateur.id, campagneId: idDe(request.params.id) })
  const entree = (request) => {
    const { type, jour, duree, annuel, titre, description, visibilite } = request.body ?? {}
    return { type, jour, duree, annuel, titre, description, visibilite }
  }

  api.get('/api/campagnes/:id/calendrier', connecte, async (request) => portail.calendrier(contexte(request)))

  api.put('/api/campagnes/:id/calendrier/date', connecte, async (request, reply) => {
    portail.changerDate({ ...contexte(request), jour: request.body?.jour })
    return reply.status(204).send()
  })

  api.put('/api/campagnes/:id/calendrier/butoir', connecte, async (request, reply) => {
    const { jour, libelle, revele } = request.body ?? {}
    portail.changerButoir({ ...contexte(request), jour, libelle, revele })
    return reply.status(204).send()
  })

  api.post('/api/campagnes/:id/calendrier/evenements', connecte, async (request, reply) => (
    reply.status(201).send(portail.creerEvenement({ ...entree(request), ...contexte(request) }))))

  api.put('/api/campagnes/:id/calendrier/evenements/:evenementId', connecte, async (request, reply) => {
    portail.modifierEvenement({ ...entree(request), ...contexte(request), evenementId: idDe(request.params.evenementId) })
    return reply.status(204).send()
  })

  api.delete('/api/campagnes/:id/calendrier/evenements/:evenementId', connecte, async (request, reply) => {
    portail.supprimerEvenement({ ...contexte(request), evenementId: idDe(request.params.evenementId) })
    return reply.status(204).send()
  })
}
