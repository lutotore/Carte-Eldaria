import { describe, expect, it } from 'vitest'
import { MDP } from '../services/aides.js'
import { appDeTest, cookieDe, inscrireParHttp, ORIGINE, requete } from './aides.js'

describe('session par cookie', () => {
  it('pose un cookie de session protégé', async () => {
    const { app } = await appDeTest()
    const reponse = await requete(app, { method: 'POST', url: '/api/session', payload: { identifiant: 'tom', motDePasse: MDP } })
    expect(reponse.statusCode).toBe(200)
    const cookie = reponse.headers['set-cookie']
    expect(cookie).toMatch(/^__Host-eldaria_session=/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/Secure/)
    expect(cookie).toMatch(/SameSite=Lax/)
    expect(cookie).toMatch(/Path=\//)
  })

  it('connecte automatiquement après avoir accepté une invitation', async () => {
    const { app, cookieTom } = await appDeTest()
    const moi = await requete(app, { url: '/api/moi', cookie: cookieTom })
    expect(moi.json()).toMatchObject({ identifiant: 'tom', campagnes: [{ nom: 'Eldaria', role: 'proprietaire' }] })
  })

  it('répond 401 sans session', async () => {
    const { app } = await appDeTest()
    const reponse = await requete(app, { url: '/api/moi' })
    expect(reponse.statusCode).toBe(401)
    expect(reponse.json().code).toBe('non_connecte')
  })

  it('efface le cookie à la déconnexion et invalide la session', async () => {
    const { app, cookieTom } = await appDeTest()
    const reponse = await requete(app, { method: 'DELETE', url: '/api/session', cookie: cookieTom })
    expect(reponse.statusCode).toBe(204)
    expect(reponse.headers['set-cookie']).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/)
    expect((await requete(app, { url: '/api/moi', cookie: cookieTom })).statusCode).toBe(401)
  })

  it('traduit les erreurs métier en codes HTTP', async () => {
    const { app } = await appDeTest()
    const reponse = await requete(app, { method: 'POST', url: '/api/session', payload: { identifiant: 'tom', motDePasse: 'faux' } })
    expect(reponse.statusCode).toBe(401)
    expect(reponse.json()).toEqual({ code: 'identifiants_incorrects', message: 'Identifiant ou mot de passe incorrect.' })
  })
})

describe('protection contre les requêtes venues d’un autre site', () => {
  it("refuse une modification dont l'origine n'est pas le portail", async () => {
    const { app, cookieTom, campagneId } = await appDeTest()
    const reponse = await app.inject({
      method: 'POST', url: `/api/campagnes/${campagneId}/invitations`, payload: { role: 'joueur' },
      headers: { origin: 'https://site-malveillant.example', cookie: cookieTom },
    })
    expect(reponse.statusCode).toBe(403)
  })

  it("refuse les corps en texte brut, qu'un formulaire piégé pourrait envoyer", async () => {
    const { app } = await appDeTest()
    const reponse = await app.inject({ method: 'POST', url: '/api/session', headers: { origin: ORIGINE, 'content-type': 'text/plain' }, payload: 'x' })
    expect(reponse.statusCode).toBe(415)
  })
})

describe('parcours complet', () => {
  it('invitation, carte joueur sans secret, état réservé au MJ', async () => {
    const { app, cookieTom, campagneId } = await appDeTest()
    const cookieLea = await inscrireParHttp(app, { campagneId, cookieProprietaire: cookieTom, identifiant: 'lea', role: 'joueur' })

    const monde = await requete(app, { url: `/api/campagnes/${campagneId}/monde`, cookie: cookieLea })
    expect(monde.statusCode).toBe(200)
    expect(monde.body).not.toMatch(/SECRET|notesMJ|croyances/)

    expect((await requete(app, { url: `/api/campagnes/${campagneId}/etat`, cookie: cookieLea })).statusCode).toBe(403)
    const etat = await requete(app, { url: `/api/campagnes/${campagneId}/etat`, cookie: cookieTom })
    expect(etat.json().etat.iles.aeronis.notesMJ).toBe('SECRET-NOTE')
  })

  it("donne un lien d'invitation complet, sur le domaine du portail", async () => {
    const { app, cookieTom, campagneId } = await appDeTest()
    const reponse = await requete(app, { method: 'POST', url: `/api/campagnes/${campagneId}/invitations`, cookie: cookieTom, payload: { role: 'mj' } })
    expect(reponse.statusCode).toBe(201)
    expect(reponse.json().lien).toMatch(new RegExp(`^${ORIGINE}/invitation/[A-Za-z0-9_-]{43}$`))
    const jeton = reponse.json().lien.split('/').at(-1)
    expect((await requete(app, { url: `/api/invitations/${jeton}` })).json()).toEqual({ campagne: 'Eldaria', role: 'mj' })
  })

  it("répond 410 pour un lien déjà utilisé et 404 pour un lien inconnu", async () => {
    const { app, cookieTom, campagneId } = await appDeTest()
    const invitation = await requete(app, { method: 'POST', url: `/api/campagnes/${campagneId}/invitations`, cookie: cookieTom, payload: { role: 'joueur' } })
    const jeton = invitation.json().lien.split('/').at(-1)
    await requete(app, { method: 'POST', url: `/api/invitations/${jeton}`, payload: { identifiant: 'lea', motDePasse: MDP } })
    expect((await requete(app, { url: `/api/invitations/${jeton}` })).statusCode).toBe(410)
    expect((await requete(app, { url: '/api/invitations/inconnu' })).statusCode).toBe(404)
  })

  it('rejoint une campagne avec le compte déjà connecté', async () => {
    const { app, portail, cookieTom } = await appDeTest()
    const autre = portail.initialiserCampagne({ nom: 'Autre table' })
    const reponse = await requete(app, { method: 'POST', url: `/api/invitations/${autre.jeton}`, cookie: cookieTom, payload: {} })
    expect(reponse.statusCode).toBe(200)
    const moi = await requete(app, { url: '/api/moi', cookie: cookieTom })
    expect(moi.json().campagnes.map((c) => c.nom)).toEqual(['Eldaria', 'Autre table'])
  })

  it('réinitialisation : lien du propriétaire, nouveau mot de passe', async () => {
    const { app, cookieTom, campagneId } = await appDeTest()
    const cookieLea = await inscrireParHttp(app, { campagneId, cookieProprietaire: cookieTom, identifiant: 'lea', role: 'joueur' })
    const leaId = (await requete(app, { url: '/api/moi', cookie: cookieLea })).json().id
    const lien = await requete(app, { method: 'POST', url: `/api/campagnes/${campagneId}/membres/${leaId}/reinitialisation`, cookie: cookieTom })
    const jeton = lien.json().lien.split('/').at(-1)
    expect((await requete(app, { url: `/api/reinitialisations/${jeton}` })).json()).toEqual({ identifiant: 'lea' })
    const reponse = await requete(app, { method: 'POST', url: `/api/reinitialisations/${jeton}`, payload: { motDePasse: 'un tout nouveau mot de passe' } })
    expect(reponse.statusCode).toBe(204)
    const connexion = await requete(app, { method: 'POST', url: '/api/session', payload: { identifiant: 'lea', motDePasse: 'un tout nouveau mot de passe' } })
    expect(connexion.statusCode).toBe(200)
  })

  it('retrait d’un membre, export et suppression de compte', async () => {
    const { app, cookieTom, campagneId } = await appDeTest()
    const cookieLea = await inscrireParHttp(app, { campagneId, cookieProprietaire: cookieTom, identifiant: 'lea', role: 'joueur' })
    const leaId = (await requete(app, { url: '/api/moi', cookie: cookieLea })).json().id

    const exportation = await requete(app, { url: '/api/moi/export', cookie: cookieLea })
    expect(exportation.headers['content-disposition']).toMatch(/attachment/)
    expect(exportation.json().compte.identifiant).toBe('lea')

    const membres = await requete(app, { url: `/api/campagnes/${campagneId}/membres`, cookie: cookieTom })
    expect(membres.json().map((m) => m.identifiant)).toEqual(['tom', 'lea'])
    expect((await requete(app, { method: 'DELETE', url: `/api/campagnes/${campagneId}/membres/${leaId}`, cookie: cookieTom })).statusCode).toBe(204)

    const suppression = await requete(app, { method: 'POST', url: '/api/moi/suppression', cookie: cookieLea, payload: { motDePasse: MDP } })
    expect(suppression.statusCode).toBe(204)
    expect((await requete(app, { url: '/api/moi', cookie: cookieLea })).statusCode).toBe(401)
  })

  it('le MJ enregistre un nouvel état en rappelant la version lue', async () => {
    const { app, cookieTom, campagneId } = await appDeTest()
    const url = `/api/campagnes/${campagneId}/etat`
    const { etat, version } = (await requete(app, { url, cookie: cookieTom })).json()
    expect(Number.isInteger(version)).toBe(true)
    etat.horloge = 4

    const ecriture = await requete(app, { method: 'PUT', url, cookie: cookieTom, payload: { etat, version } })
    expect(ecriture.statusCode).toBe(200)
    expect(ecriture.json()).toEqual({ version: version + 1 })
    expect((await requete(app, { url, cookie: cookieTom })).json().etat.horloge).toBe(4)

    const perimee = await requete(app, { method: 'PUT', url, cookie: cookieTom, payload: { etat, version } })
    expect(perimee.statusCode).toBe(409)
    expect(perimee.json().code).toBe('conflit')
  })

  it("refuse une écriture qui ne dit pas quelle version elle remplace", async () => {
    const { app, cookieTom, campagneId } = await appDeTest()
    const url = `/api/campagnes/${campagneId}/etat`
    const { etat } = (await requete(app, { url, cookie: cookieTom })).json()
    const reponse = await requete(app, { method: 'PUT', url, cookie: cookieTom, payload: { etat } })
    expect(reponse.statusCode).toBe(400)
  })

  it('répond 404 pour un identifiant de campagne qui n’est pas un nombre', async () => {
    const { app, cookieTom } = await appDeTest()
    expect((await requete(app, { url: '/api/campagnes/abc/monde', cookie: cookieTom })).statusCode).toBe(404)
  })
})

describe('limitation des tentatives de connexion', () => {
  it('bloque après 10 essais en 15 minutes', async () => {
    const { app } = await appDeTest()
    const essai = () => requete(app, { method: 'POST', url: '/api/session', payload: { identifiant: 'tom', motDePasse: 'faux' } })
    for (let i = 0; i < 10; i += 1) expect((await essai()).statusCode).toBe(401)
    const bloque = await essai()
    expect(bloque.statusCode).toBe(429)
    expect(bloque.json().code).toBe('trop_de_tentatives')
  })
})

describe('limitation sur les formulaires qui vérifient le mot de passe actuel', () => {
  it('bloque la devinette du mot de passe avec une session volée', async () => {
    const { app, cookieTom } = await appDeTest()
    const essai = () => requete(app, { method: 'POST', url: '/api/moi/suppression', cookie: cookieTom, payload: { motDePasse: 'faux' } })
    for (let i = 0; i < 10; i += 1) await essai()
    expect((await essai()).statusCode).toBe(429)
  })
})

describe('adresse IP derrière Caddy', () => {
  it("ne fait confiance qu'au dernier relais : un X-Forwarded-For inventé ne contourne pas la limite", async () => {
    const { portailDeTest: fabrique } = await import('../services/aides.js')
    const { construireApp } = await import('../../src/http/app.js')
    const { portail } = fabrique()
    const app = construireApp({ portail, config: { origine: ORIGINE, cookieSecurise: true, journal: false, derriereProxy: true } })
    const essai = (i) => app.inject({
      method: 'POST', url: '/api/session', payload: { identifiant: 'x', motDePasse: 'y' },
      headers: { origin: ORIGINE, 'x-forwarded-for': `1.2.3.${i}, 9.9.9.9` },
    })
    const statuts = []
    for (let i = 0; i < 12; i += 1) statuts.push((await essai(i)).statusCode)
    expect(statuts.at(-1)).toBe(429)
  })
})

describe('journal', () => {
  it('masque les jetons présents dans les adresses', async () => {
    const { masquerJetons } = await import('../../src/http/app.js')
    expect(masquerJetons('/api/invitations/abcDEF123_-xyz')).toBe('/api/invitations/***')
    expect(masquerJetons('/api/reinitialisations/abc')).toBe('/api/reinitialisations/***')
    expect(masquerJetons('/api/moi')).toBe('/api/moi')
  })
})
