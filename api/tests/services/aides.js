import { readFileSync } from 'node:fs'
import { ouvrirBase } from '../../src/infra/base.js'
import { creerPortail } from '../../src/services/portail.js'

export const MDP = 'une phrase de passe solide'

/** Portail sur base en mémoire, horloge maîtrisée et hachage rapide. */
export function portailDeTest() {
  const horloge = { maintenant: new Date('2026-10-05T20:00:00Z') }
  const db = ouvrirBase(':memory:')
  const portail = creerPortail({ db, maintenant: () => horloge.maintenant, coutMotDePasse: { N: 1024 } })
  const avancer = (jours) => { horloge.maintenant = new Date(horloge.maintenant.getTime() + jours * 86_400_000) }
  return { db, portail, avancer }
}

/** Une campagne avec son propriétaire « tom » déjà inscrit. */
export async function campagneAvecProprietaire(portail) {
  const { campagneId, jeton } = portail.initialiserCampagne({ nom: 'Eldaria' })
  const { utilisateurId } = await portail.accepterInvitation(jeton, { identifiant: 'tom', motDePasse: MDP })
  return { campagneId, tomId: utilisateurId }
}

/** Invite puis inscrit un membre avec le rôle donné. */
export async function inscrire(portail, { campagneId, proprietaireId, identifiant, role }) {
  const { jeton } = portail.creerInvitation({ demandeurId: proprietaireId, campagneId, role })
  const { utilisateurId } = await portail.accepterInvitation(jeton, { identifiant, motDePasse: MDP })
  return utilisateurId
}

export const etatExemple = () => JSON.parse(readFileSync(new URL('./etat-exemple.json', import.meta.url), 'utf8'))
