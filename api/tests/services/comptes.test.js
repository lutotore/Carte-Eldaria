import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, inscrire, MDP, portailDeTest } from './aides.js'

describe('story 1 : le propriétaire crée une campagne', () => {
  it('crée la campagne et un lien pour que le propriétaire choisisse ses identifiants', async () => {
    const { portail } = portailDeTest()
    const { campagneId, jeton } = portail.initialiserCampagne({ nom: 'Eldaria' })
    expect(portail.decrireInvitation(jeton)).toEqual({ campagne: 'Eldaria', role: 'proprietaire' })
    const { utilisateurId } = await portail.accepterInvitation(jeton, { identifiant: 'tom', motDePasse: MDP })
    expect(portail.profil(utilisateurId).campagnes).toEqual([{ id: campagneId, nom: 'Eldaria', role: 'proprietaire' }])
  })

  it('refuse une campagne sans nom', () => {
    const { portail } = portailDeTest()
    expect(() => portail.initialiserCampagne({ nom: '  ' })).toThrow(/nom/)
  })
})

describe("story 2 : le propriétaire génère un lien d'invitation", () => {
  it('produit un lien valable 7 jours pour le rôle choisi', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const invitation = portail.creerInvitation({ demandeurId: tomId, campagneId, role: 'joueur' })
    expect(invitation.expireLe).toBe('2026-10-12T20:00:00.000Z')
    expect(portail.decrireInvitation(invitation.jeton)).toEqual({ campagne: 'Eldaria', role: 'joueur' })
  })

  it("refuse l'invitation à un rôle inconnu ou de propriétaire", async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    expect(() => portail.creerInvitation({ demandeurId: tomId, campagneId, role: 'proprietaire' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    expect(() => portail.creerInvitation({ demandeurId: tomId, campagneId, role: 'dieu' })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it("interdit à un MJ ou un joueur d'inviter", async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const mjId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'co-mj', role: 'mj' })
    expect(() => portail.creerInvitation({ demandeurId: mjId, campagneId, role: 'joueur' })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })

  it("interdit d'inviter dans la campagne d'un autre", async () => {
    const { portail } = portailDeTest()
    const { tomId } = await campagneAvecProprietaire(portail)
    const autre = portail.initialiserCampagne({ nom: 'Autre table' })
    expect(() => portail.creerInvitation({ demandeurId: tomId, campagneId: autre.campagneId, role: 'joueur' })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })
})

describe("story 3 : l'invité rejoint la campagne", () => {
  it('crée son compte avec le rôle prévu', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const id = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'occasionnel' })
    expect(portail.profil(id)).toEqual({ id, identifiant: 'lea', campagnes: [{ id: campagneId, nom: 'Eldaria', role: 'occasionnel' }] })
  })

  it("ne sert qu'une fois", async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const { jeton } = portail.creerInvitation({ demandeurId: tomId, campagneId, role: 'joueur' })
    await portail.accepterInvitation(jeton, { identifiant: 'lea', motDePasse: MDP })
    await expect(portail.accepterInvitation(jeton, { identifiant: 'intrus', motDePasse: MDP })).rejects.toMatchObject({ code: 'lien_utilise' })
  })

  it('expire au bout de 7 jours', async () => {
    const { portail, avancer } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const { jeton } = portail.creerInvitation({ demandeurId: tomId, campagneId, role: 'joueur' })
    avancer(7)
    expect(() => portail.decrireInvitation(jeton)).toThrow(expect.objectContaining({ code: 'lien_expire' }))
    await expect(portail.accepterInvitation(jeton, { identifiant: 'lea', motDePasse: MDP })).rejects.toMatchObject({ code: 'lien_expire' })
  })

  it('refuse un lien inventé', () => {
    const { portail } = portailDeTest()
    expect(() => portail.decrireInvitation('invente')).toThrow(expect.objectContaining({ code: 'lien_inconnu' }))
  })

  it('refuse un identifiant déjà pris, sans consommer le lien', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const { jeton } = portail.creerInvitation({ demandeurId: tomId, campagneId, role: 'joueur' })
    await expect(portail.accepterInvitation(jeton, { identifiant: 'TOM', motDePasse: MDP })).rejects.toMatchObject({ code: 'identifiant_pris' })
    await expect(portail.accepterInvitation(jeton, { identifiant: 'lea', motDePasse: MDP })).resolves.toBeDefined()
  })

  it('refuse un identifiant ou un mot de passe non conforme', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const { jeton } = portail.creerInvitation({ demandeurId: tomId, campagneId, role: 'joueur' })
    await expect(portail.accepterInvitation(jeton, { identifiant: 'a b', motDePasse: MDP })).rejects.toMatchObject({ code: 'requete_invalide' })
    await expect(portail.accepterInvitation(jeton, { identifiant: 'lea', motDePasse: 'court' })).rejects.toMatchObject({ code: 'requete_invalide' })
  })

  it("permet de rejoindre avec un compte existant (joueur d'une autre table)", async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    const autre = portail.initialiserCampagne({ nom: 'Autre table' })
    await portail.accepterInvitation(autre.jeton, { utilisateurId: leaId })
    expect(portail.profil(leaId).campagnes.map((c) => c.nom)).toEqual(['Eldaria', 'Autre table'])
  })

  it('refuse de rejoindre deux fois la même campagne', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const { jeton } = portail.creerInvitation({ demandeurId: tomId, campagneId, role: 'mj' })
    await expect(portail.accepterInvitation(jeton, { utilisateurId: tomId })).rejects.toMatchObject({ code: 'deja_membre' })
  })
})

describe('story 4 : connexion et déconnexion', () => {
  it('ouvre une session avec les bons identifiants, sans tenir compte de la casse', async () => {
    const { portail } = portailDeTest()
    const { tomId } = await campagneAvecProprietaire(portail)
    const { jeton } = await portail.connecter({ identifiant: 'TOM', motDePasse: MDP })
    expect(portail.utilisateurDeSession(jeton)).toEqual({ id: tomId, identifiant: 'tom' })
  })

  it('donne la même réponse pour un identifiant inconnu et un mauvais mot de passe', async () => {
    const { portail } = portailDeTest()
    await campagneAvecProprietaire(portail)
    await expect(portail.connecter({ identifiant: 'personne', motDePasse: MDP })).rejects.toMatchObject({ code: 'identifiants_incorrects' })
    await expect(portail.connecter({ identifiant: 'tom', motDePasse: 'mauvais mot de passe' })).rejects.toMatchObject({ code: 'identifiants_incorrects' })
  })

  it('ferme la session à la déconnexion', async () => {
    const { portail } = portailDeTest()
    await campagneAvecProprietaire(portail)
    const { jeton } = await portail.connecter({ identifiant: 'tom', motDePasse: MDP })
    portail.deconnecter(jeton)
    expect(portail.utilisateurDeSession(jeton)).toBeNull()
  })

  it('fait expirer la session au bout de 30 jours', async () => {
    const { portail, avancer } = portailDeTest()
    await campagneAvecProprietaire(portail)
    const { jeton } = await portail.connecter({ identifiant: 'tom', motDePasse: MDP })
    avancer(29)
    expect(portail.utilisateurDeSession(jeton)).not.toBeNull()
    avancer(1)
    expect(portail.utilisateurDeSession(jeton)).toBeNull()
  })

  it("ne conserve que l'empreinte du jeton de session", async () => {
    const { db, portail } = portailDeTest()
    await campagneAvecProprietaire(portail)
    const { jeton } = await portail.connecter({ identifiant: 'tom', motDePasse: MDP })
    const ligne = db.prepare('SELECT empreinte_jeton FROM sessions').get()
    expect(ligne.empreinte_jeton).not.toBe(jeton)
  })
})

describe('story 5 : le propriétaire réinitialise un mot de passe', () => {
  it('produit un lien qui permet de choisir un nouveau mot de passe', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    const { jeton } = portail.creerReinitialisation({ demandeurId: tomId, campagneId, cibleId: leaId })
    expect(portail.decrireReinitialisation(jeton)).toEqual({ identifiant: 'lea' })
    await portail.reinitialiser(jeton, 'un tout nouveau mot de passe')
    await expect(portail.connecter({ identifiant: 'lea', motDePasse: MDP })).rejects.toMatchObject({ code: 'identifiants_incorrects' })
    await expect(portail.connecter({ identifiant: 'lea', motDePasse: 'un tout nouveau mot de passe' })).resolves.toBeDefined()
  })

  it('ferme toutes les sessions ouvertes du compte', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    const session = await portail.connecter({ identifiant: 'lea', motDePasse: MDP })
    const { jeton } = portail.creerReinitialisation({ demandeurId: tomId, campagneId, cibleId: leaId })
    await portail.reinitialiser(jeton, 'un tout nouveau mot de passe')
    expect(portail.utilisateurDeSession(session.jeton)).toBeNull()
  })

  it("ne sert qu'une fois et expire en 2 jours", async () => {
    const { portail, avancer } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    const premier = portail.creerReinitialisation({ demandeurId: tomId, campagneId, cibleId: leaId })
    await portail.reinitialiser(premier.jeton, 'un tout nouveau mot de passe')
    await expect(portail.reinitialiser(premier.jeton, 'encore un autre mot de passe')).rejects.toMatchObject({ code: 'lien_utilise' })
    const second = portail.creerReinitialisation({ demandeurId: tomId, campagneId, cibleId: leaId })
    avancer(2)
    await expect(portail.reinitialiser(second.jeton, 'encore un autre mot de passe')).rejects.toMatchObject({ code: 'lien_expire' })
  })

  it("est réservé au propriétaire, et seulement pour les membres de sa campagne", async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const mjId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'co-mj', role: 'mj' })
    expect(() => portail.creerReinitialisation({ demandeurId: mjId, campagneId, cibleId: tomId })).toThrow(expect.objectContaining({ code: 'interdit' }))
    const autre = portail.initialiserCampagne({ nom: 'Autre table' })
    const { utilisateurId: etrangerId } = await portail.accepterInvitation(autre.jeton, { identifiant: 'etranger', motDePasse: MDP })
    expect(() => portail.creerReinitialisation({ demandeurId: tomId, campagneId, cibleId: etrangerId })).toThrow(expect.objectContaining({ code: 'introuvable' }))
  })
})

describe('story 5 : un propriétaire ne peut pas prendre le contrôle du compte d’un autre MJ', () => {
  it("refuse la réinitialisation d'un compte qui appartient aussi à une campagne dont il n'est pas propriétaire", async () => {
    const { portail } = portailDeTest()
    const { tomId } = await campagneAvecProprietaire(portail)
    // Ève crée sa propre campagne et y invite Tom, qui accepte avec son compte.
    const campagneEve = portail.initialiserCampagne({ nom: "Table d'Ève" })
    const { utilisateurId: eveId } = await portail.accepterInvitation(campagneEve.jeton, { identifiant: 'eve', motDePasse: MDP })
    const invitation = portail.creerInvitation({ demandeurId: eveId, campagneId: campagneEve.campagneId, role: 'joueur' })
    await portail.accepterInvitation(invitation.jeton, { utilisateurId: tomId })
    expect(() => portail.creerReinitialisation({ demandeurId: eveId, campagneId: campagneEve.campagneId, cibleId: tomId }))
      .toThrow(expect.objectContaining({ code: 'interdit' }))
  })
})

describe('story 6 : le propriétaire retire un membre', () => {
  it('retire le membre de la campagne', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    portail.retirerMembre({ demandeurId: tomId, campagneId, cibleId: leaId })
    expect(portail.profil(leaId).campagnes).toEqual([])
    expect(portail.membres({ demandeurId: tomId, campagneId }).map((m) => m.identifiant)).toEqual(['tom'])
  })

  it('ne permet pas au propriétaire de se retirer lui-même', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    expect(() => portail.retirerMembre({ demandeurId: tomId, campagneId, cibleId: tomId })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it('est réservé au propriétaire', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const mjId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'co-mj', role: 'mj' })
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    expect(() => portail.retirerMembre({ demandeurId: mjId, campagneId, cibleId: leaId })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })

  it('liste les membres avec leur rôle, visible des MJ mais pas des joueurs', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const mjId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'co-mj', role: 'mj' })
    const leaId = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    expect(portail.membres({ demandeurId: mjId, campagneId })).toEqual([
      { id: tomId, identifiant: 'tom', role: 'proprietaire', rejointLe: '2026-10-05T20:00:00.000Z' },
      { id: mjId, identifiant: 'co-mj', role: 'mj', rejointLe: '2026-10-05T20:00:00.000Z' },
      { id: leaId, identifiant: 'lea', role: 'joueur', rejointLe: '2026-10-05T20:00:00.000Z' },
    ])
    expect(() => portail.membres({ demandeurId: leaId, campagneId })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })
})
