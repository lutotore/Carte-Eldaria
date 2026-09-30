/**
 * Ce que l'interface affiche selon le rôle. Ce n'est qu'un confort :
 * c'est le serveur qui applique réellement les droits.
 */
export const NOMS_ROLES = { proprietaire: 'MJ principal', mj: 'MJ', joueur: 'Joueur', occasionnel: 'Joueur occasionnel' }

export function campagneDe(moi, id) {
  return moi?.campagnes.find((c) => c.id === Number(id)) ?? null
}

export const estMj = (campagne) => campagne?.role === 'proprietaire' || campagne?.role === 'mj'
export const estProprietaire = (campagne) => campagne?.role === 'proprietaire'
export const repondAuxSondages = (campagne) => campagne?.role === 'joueur'
