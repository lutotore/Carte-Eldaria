import { idDe } from '../outils.js'

/** Pupitre de séance du MJ (scènes, révélations groupées, note au Journal) et « Quoi de neuf » des joueurs. */
export function routesSeance(api, portail) {
  const connecte = { preHandler: api.connecte }
  const contexte = (request) => ({ demandeurId: request.utilisateur.id, campagneId: idDe(request.params.id) })
  const corps = (request) => request.body ?? {}

  api.get('/api/campagnes/:id/scenes', connecte, async (request) => portail.scenes(contexte(request)))

  // Toute la scène, ou un élément (`element` : sa position dans la scène).
  api.post('/api/campagnes/:id/scenes/:sceneId/revelation', connecte, async (request, reply) => {
    const { element = null, pourTous = false, joueurs = [], masquer = false } = corps(request)
    portail.revelerScene({ ...contexte(request), sceneId: idDe(request.params.sceneId), element, pourTous, joueurs, masquer })
    return reply.status(204).send()
  })

  api.post('/api/campagnes/:id/revelations', connecte, async (request, reply) => {
    const { fiches, pourTous = false, joueurs = [], masquer = false } = corps(request)
    portail.revelerEnLot({ ...contexte(request), fiches, pourTous, joueurs, masquer })
    return reply.status(204).send()
  })

  // « Quoi de neuf » d'un membre (joueur ou MJ) : le fil de la campagne, puis tout marqué comme vu.
  api.get('/api/campagnes/:id/nouveautes', connecte, async (request) => portail.quoiDeNeuf(contexte(request)))
  api.post('/api/campagnes/:id/nouveautes/lues', connecte, async (request, reply) => {
    portail.marquerNouveautesLues(contexte(request))
    return reply.status(204).send()
  })

  api.post('/api/campagnes/:id/journal', connecte, async (request) => portail.noterAuJournal({ ...contexte(request), texte: corps(request).texte }))
}
