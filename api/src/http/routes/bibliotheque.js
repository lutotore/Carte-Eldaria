import { ErreurMetier } from '../../domaine/erreurs.js'
import { idDe } from '../outils.js'

const IDENTIFIANT_IMAGE = /^[a-f0-9-]{36}$/

export function routesBibliotheque(api, portail) {
  const connecte = { preHandler: api.connecte }
  const contexte = (request) => ({ demandeurId: request.utilisateur.id, campagneId: idDe(request.params.id) })
  const deFiche = (request) => ({ ...contexte(request), ficheId: idDe(request.params.ficheId) })
  const deFacette = (request) => ({ ...deFiche(request), facetteId: idDe(request.params.facetteId) })
  const deNote = (request) => ({ ...contexte(request), noteId: idDe(request.params.noteId) })
  const vide = (reply) => reply.status(204).send()
  const corps = (request) => request.body ?? {}

  api.get('/api/campagnes/:id/bibliotheque', connecte, async (request) =>
    portail.bibliotheque({ ...contexte(request), type: request.query.type ?? 'pnj' }))

  api.post('/api/campagnes/:id/fiches', connecte, async (request, reply) => {
    const { nom, type } = corps(request)
    return reply.status(201).send(portail.creerFiche({ ...contexte(request), nom, type }))
  })

  api.get('/api/campagnes/:id/fiches/:ficheId', connecte, async (request) => portail.fiche(deFiche(request)))

  api.delete('/api/campagnes/:id/fiches/:ficheId', connecte, async (request, reply) => {
    portail.supprimerFiche(deFiche(request))
    return vide(reply)
  })

  api.put('/api/campagnes/:id/fiches/:ficheId/facettes/:facetteId', connecte, async (request, reply) => {
    const { valeur, titre } = corps(request)
    portail.modifierFacette({ ...deFacette(request), valeur, titre })
    return vide(reply)
  })

  api.delete('/api/campagnes/:id/fiches/:ficheId/facettes/:facetteId', connecte, async (request, reply) => {
    portail.supprimerSecret(deFacette(request))
    return vide(reply)
  })

  api.post('/api/campagnes/:id/fiches/:ficheId/secrets', connecte, async (request, reply) => {
    const { titre, texte } = corps(request)
    return reply.status(201).send(portail.ajouterSecret({ ...deFiche(request), titre, texte }))
  })

  // Élément titré ajouté à une fiche : secret, capacité, action ou réaction.
  api.post('/api/campagnes/:id/fiches/:ficheId/elements', connecte, async (request, reply) => {
    const { cle, titre, texte } = corps(request)
    return reply.status(201).send(portail.ajouterTitree({ ...deFiche(request), cle, titre, texte }))
  })

  api.post('/api/campagnes/:id/fiches/:ficheId/revelation-totale', connecte, async (request, reply) => {
    portail.revelerTout(deFiche(request))
    return vide(reply)
  })

  api.put('/api/campagnes/:id/fiches/:ficheId/estimations/:cle', connecte, async (request, reply) => {
    portail.estimer({ ...deFiche(request), cle: request.params.cle, texte: corps(request).texte })
    return vide(reply)
  })

  api.put('/api/campagnes/:id/fiches/:ficheId/ile', connecte, async (request, reply) => {
    portail.changerIle({ ...deFiche(request), ile: corps(request).ile ?? '' })
    return vide(reply)
  })

  api.post('/api/campagnes/:id/fiches/:ficheId/partage', connecte, async (request, reply) => {
    portail.partager(deFiche(request))
    return vide(reply)
  })

  api.put('/api/campagnes/:id/fiches/:ficheId/notes-mj', { ...connecte, bodyLimit: 256 * 1024 }, async (request, reply) => {
    portail.modifierNotesMj({ ...deFiche(request), notesMj: corps(request).notesMj })
    return vide(reply)
  })

  api.put('/api/campagnes/:id/fiches/:ficheId/facettes/:facetteId/revelation', connecte, async (request, reply) => {
    const { pourTous, joueurs } = corps(request)
    portail.reveler({ ...deFacette(request), pourTous, joueurs })
    return vide(reply)
  })

  // Le portrait arrive brut (Content-Type image/png, image/jpeg ou image/webp) : pas de formulaire multipart.
  api.put('/api/campagnes/:id/fiches/:ficheId/portrait', connecte, async (request) =>
    portail.definirPortrait({ ...deFiche(request), octets: request.body }))

  api.get('/api/campagnes/:id/images/:imageId', connecte, async (request, reply) => {
    const { imageId } = request.params
    if (!IDENTIFIANT_IMAGE.test(imageId)) throw new ErreurMetier('introuvable', 'Image introuvable.')
    const { octets, type } = portail.lireImage({ ...contexte(request), imageId })
    // Cache du navigateur seulement (private) : un portrait ne doit pas être gardé par un intermédiaire.
    // Un PDF se télécharge plutôt que de s'ouvrir sous la politique de sécurité stricte du site.
    if (type === 'application/pdf') reply.header('Content-Disposition', 'attachment; filename="document.pdf"')
    return reply.header('Content-Type', type).header('Cache-Control', 'private, max-age=86400').send(octets)
  })

  api.post('/api/campagnes/:id/fiches/:ficheId/notes', connecte, async (request, reply) => {
    const { type, visibilite, texte } = corps(request)
    return reply.status(201).send(portail.ajouterNote({ ...deFiche(request), type, visibilite, texte }))
  })

  api.put('/api/campagnes/:id/notes/:noteId', connecte, async (request, reply) => {
    const { texte, visibilite } = corps(request)
    portail.modifierNote({ ...deNote(request), texte, visibilite })
    return vide(reply)
  })

  api.delete('/api/campagnes/:id/notes/:noteId', connecte, async (request, reply) => {
    portail.supprimerNote(deNote(request))
    return vide(reply)
  })

  api.post('/api/campagnes/:id/notes/:noteId/comptage', connecte, async (request, reply) => {
    portail.compterCroyance({ ...deNote(request), lecture: corps(request).lecture })
    return vide(reply)
  })
}
