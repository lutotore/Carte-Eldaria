import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, inscrire, MDP, portailDeTest } from './aides.js'

describe('droits sur son compte (RGPD)', () => {
  it('change son mot de passe en donnant l’actuel, et ferme les autres sessions', async () => {
    const { portail } = portailDeTest()
    const { tomId } = await campagneAvecProprietaire(portail)
    const ailleurs = await portail.connecter({ identifiant: 'tom', motDePasse: MDP })
    const ici = await portail.connecter({ identifiant: 'tom', motDePasse: MDP })
    await portail.changerMotDePasse({ utilisateurId: tomId, actuel: MDP, nouveau: 'mon nouveau mot de passe', jetonConserve: ici.jeton })
    expect(portail.utilisateurDeSession(ailleurs.jeton)).toBeNull()
    expect(portail.utilisateurDeSession(ici.jeton)).not.toBeNull()
    await expect(portail.connecter({ identifiant: 'tom', motDePasse: 'mon nouveau mot de passe' })).resolves.toBeDefined()
  })

  it("refuse le changement si l'ancien mot de passe est faux", async () => {
    const { portail } = portailDeTest()
    const { tomId } = await campagneAvecProprietaire(portail)
    await expect(portail.changerMotDePasse({ utilisateurId: tomId, actuel: 'faux', nouveau: 'mon nouveau mot de passe' })).rejects.toMatchObject({ code: 'identifiants_incorrects' })
  })

  it('exporte toutes les données personnelles du compte', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    await portail.connecter({ identifiant: 'lea', motDePasse: MDP })
    const exportation = portail.exporterDonnees(leaId)
    expect(exportation).toMatchObject({
      compte: { identifiant: 'lea', creeLe: '2026-10-05T20:00:00.000Z' },
      campagnes: [{ nom: 'Eldaria', role: 'joueur', rejointLe: '2026-10-05T20:00:00.000Z' }],
      sessions: [{ creeLe: '2026-10-05T20:00:00.000Z', expireLe: '2026-11-04T20:00:00.000Z' }],
    })
    expect(JSON.stringify(exportation)).not.toMatch(/scrypt/)
  })

  it('supprime le compte et tout ce qui s’y rattache', async () => {
    const { db, portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    const session = await portail.connecter({ identifiant: 'lea', motDePasse: MDP })
    await portail.supprimerCompte({ utilisateurId: leaId, motDePasse: MDP })
    expect(portail.utilisateurDeSession(session.jeton)).toBeNull()
    expect(db.prepare('SELECT COUNT(*) AS n FROM participations WHERE utilisateur_id = ?').get(leaId).n).toBe(0)
    await expect(portail.connecter({ identifiant: 'lea', motDePasse: MDP })).rejects.toMatchObject({ code: 'identifiants_incorrects' })
  })

  it('demande le mot de passe pour supprimer le compte', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    await expect(portail.supprimerCompte({ utilisateurId: leaId, motDePasse: 'faux' })).rejects.toMatchObject({ code: 'identifiants_incorrects' })
  })

  it("refuse de supprimer le compte du propriétaire d'une campagne", async () => {
    const { portail } = portailDeTest()
    const { tomId } = await campagneAvecProprietaire(portail)
    await expect(portail.supprimerCompte({ utilisateurId: tomId, motDePasse: MDP })).rejects.toMatchObject({ code: 'requete_invalide' })
  })

  it('efface les sessions et liens périmés', async () => {
    const { db, portail, avancer } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    await portail.connecter({ identifiant: 'tom', motDePasse: MDP })
    portail.creerInvitation({ demandeurId: tomId, campagneId, role: 'joueur' })
    avancer(31)
    portail.purger()
    const compter = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n
    expect([compter('sessions'), compter('invitations'), compter('reinitialisations')]).toEqual([0, 0, 0])
  })

  it('supprime un compte qui ne fait plus partie d’aucune campagne, une fois ses sessions expirées', async () => {
    const { portail, avancer } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    const maxId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'max', role: 'joueur' })
    await portail.connecter({ identifiant: 'lea', motDePasse: MDP })
    portail.retirerMembre({ demandeurId: tomId, campagneId, cibleId: leaId })
    portail.purger()
    expect(() => portail.profil(leaId)).not.toThrow()
    avancer(30)
    portail.purger()
    expect(() => portail.profil(leaId)).toThrow(expect.objectContaining({ code: 'introuvable' }))
    expect(portail.profil(maxId).identifiant).toBe('max')
    expect(portail.profil(tomId).identifiant).toBe('tom')
  })
})
