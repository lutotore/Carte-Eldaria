import { idDe } from '../outils.js'

/**
 * Fiches de personnage, inventaire, Marques du Rêve et butins.
 * Les champs du corps sont repris un par un : jamais de quoi remplacer le demandeur ou la campagne.
 */
export function routesPersonnages(api, portail) {
  const connecte = { preHandler: api.connecte }
  const contexte = (request) => ({ demandeurId: request.utilisateur.id, campagneId: idDe(request.params.id) })
  const perso = (request) => ({ ...contexte(request), personnageId: idDe(request.params.personnageId) })
  const butin = (request) => ({ ...contexte(request), butinId: idDe(request.params.butinId) })
  const corps = (request) => request.body ?? {}
  const sansContenu = (reply) => reply.status(204).send()

  api.get('/api/campagnes/:id/personnages', connecte, async (request) => portail.personnages(contexte(request)))
  api.post('/api/campagnes/:id/personnages', connecte, async (request, reply) => (
    reply.status(201).send(portail.creerPersonnage({ ...contexte(request), nom: corps(request).nom }))))
  api.get('/api/campagnes/:id/personnages/:personnageId', connecte, async (request) => portail.personnage(perso(request)))
  api.put('/api/campagnes/:id/personnages/:personnageId', connecte, async (request, reply) => {
    portail.modifierPersonnage({ ...perso(request), champs: corps(request).champs })
    return sansContenu(reply)
  })
  api.delete('/api/campagnes/:id/personnages/:personnageId', connecte, async (request, reply) => {
    portail.supprimerPersonnage(perso(request))
    return sansContenu(reply)
  })
  api.put('/api/campagnes/:id/personnages/:personnageId/bourse', connecte, async (request, reply) => {
    const { avant, apres } = corps(request)
    portail.changerBourse({ ...perso(request), avant, apres })
    return sansContenu(reply)
  })

  const ligne = (request) => {
    const { libelle, quantite, notes } = corps(request)
    return { libelle, quantite, notes }
  }
  api.post('/api/campagnes/:id/personnages/:personnageId/inventaire', connecte, async (request, reply) => (
    reply.status(201).send(portail.ajouterLigne({ ...ligne(request), ...perso(request) }))))
  api.put('/api/campagnes/:id/personnages/:personnageId/inventaire/:ligneId', connecte, async (request, reply) => {
    portail.modifierLigne({ ...ligne(request), ...perso(request), ligneId: idDe(request.params.ligneId) })
    return sansContenu(reply)
  })
  api.delete('/api/campagnes/:id/personnages/:personnageId/inventaire/:ligneId', connecte, async (request, reply) => {
    portail.supprimerLigne({ ...perso(request), ligneId: idDe(request.params.ligneId) })
    return sansContenu(reply)
  })

  const marque = (request) => {
    const { titre, don, prix } = corps(request)
    return { titre, don, prix }
  }
  api.post('/api/campagnes/:id/personnages/:personnageId/marques', connecte, async (request, reply) => (
    reply.status(201).send(portail.ajouterMarque({ ...marque(request), ...perso(request) }))))
  api.put('/api/campagnes/:id/personnages/:personnageId/marques/:marqueId', connecte, async (request, reply) => {
    portail.modifierMarque({ ...marque(request), ...perso(request), marqueId: idDe(request.params.marqueId) })
    return sansContenu(reply)
  })
  api.delete('/api/campagnes/:id/personnages/:personnageId/marques/:marqueId', connecte, async (request, reply) => {
    portail.supprimerMarque({ ...perso(request), marqueId: idDe(request.params.marqueId) })
    return sansContenu(reply)
  })

  // --- Butins ---
  const contenuButin = (request) => {
    const { titre, notesMj, pieces } = corps(request)
    return { titre, notesMj, pieces }
  }
  const objet = (request) => {
    const { libelle, quantite, description, ficheId } = corps(request)
    return { libelle, quantite, description, ficheId: ficheId === null || ficheId === undefined ? null : idDe(String(ficheId)) }
  }
  api.get('/api/campagnes/:id/butins', connecte, async (request) => portail.butins(contexte(request)))
  api.post('/api/campagnes/:id/butins', connecte, async (request, reply) => (
    reply.status(201).send(portail.creerButin({ ...contenuButin(request), ...contexte(request) }))))
  api.put('/api/campagnes/:id/butins/:butinId', connecte, async (request, reply) => {
    portail.modifierButin({ ...contenuButin(request), ...butin(request) })
    return sansContenu(reply)
  })
  api.delete('/api/campagnes/:id/butins/:butinId', connecte, async (request, reply) => {
    portail.supprimerButin(butin(request))
    return sansContenu(reply)
  })
  api.put('/api/campagnes/:id/butins/:butinId/statut', connecte, async (request, reply) => {
    portail.changerStatutButin({ ...butin(request), statut: corps(request).statut })
    return sansContenu(reply)
  })
  api.post('/api/campagnes/:id/butins/:butinId/objets', connecte, async (request, reply) => (
    reply.status(201).send(portail.ajouterObjetButin({ ...objet(request), ...butin(request) }))))
  api.put('/api/campagnes/:id/butins/:butinId/objets/:objetId', connecte, async (request, reply) => {
    portail.modifierObjetButin({ ...objet(request), ...butin(request), objetId: idDe(request.params.objetId) })
    return sansContenu(reply)
  })
  api.delete('/api/campagnes/:id/butins/:butinId/objets/:objetId', connecte, async (request, reply) => {
    portail.supprimerObjetButin({ ...butin(request), objetId: idDe(request.params.objetId) })
    return sansContenu(reply)
  })
  api.post('/api/campagnes/:id/butins/:butinId/objets/:objetId/prise', connecte, async (request, reply) => {
    portail.prendreObjet({ ...butin(request), objetId: idDe(request.params.objetId), quantite: corps(request).quantite })
    return sansContenu(reply)
  })
  api.post('/api/campagnes/:id/butins/:butinId/pieces/prise', connecte, async (request, reply) => {
    portail.prendrePieces({ ...butin(request), pieces: corps(request).pieces })
    return sansContenu(reply)
  })
}
