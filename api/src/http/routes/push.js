import { idDe } from '../outils.js'

/** Notifications sur les appareils (push) et annonces du MJ. */
export function routesPush(api, portail) {
  const connecte = { preHandler: api.connecte }
  const moi = (request) => ({ utilisateurId: request.utilisateur.id })

  api.get('/api/moi/push', connecte, async (request) => ({
    cle: portail.clePubliquePush(),
    appareils: portail.appareilsPush(moi(request)),
    preferences: portail.preferencesPush(moi(request)),
  }))

  api.post('/api/moi/push', connecte, async (request, reply) => {
    const { abonnement, appareil } = request.body ?? {}
    portail.abonnerAppareil({ ...moi(request), abonnement, appareil })
    return reply.status(204).send()
  })

  api.post('/api/moi/push/verification', connecte, async (request) => ({
    abonne: portail.appareilAbonne({ ...moi(request), adresse: String(request.body?.adresse ?? '') }),
  }))

  api.post('/api/moi/push/desabonnement', connecte, async (request, reply) => {
    portail.desabonnerAppareil({ ...moi(request), adresse: request.body?.adresse })
    return reply.status(204).send()
  })

  api.delete('/api/moi/push/appareils/:appareilId', connecte, async (request, reply) => {
    portail.retirerAppareil({ ...moi(request), appareilId: idDe(request.params.appareilId) })
    return reply.status(204).send()
  })

  api.put('/api/moi/push/preferences', connecte, async (request, reply) => {
    portail.changerPreferencesPush({ ...moi(request), actives: request.body?.actives })
    return reply.status(204).send()
  })

  api.post('/api/campagnes/:id/annonces', connecte, async (request, reply) => {
    const { texte, destinataires } = request.body ?? {}
    return reply.status(201).send(portail.envoyerAnnonce({ texte, destinataires, demandeurId: request.utilisateur.id, campagneId: idDe(request.params.id) }))
  })
}
