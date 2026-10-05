import { createECDH, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { appDeTest, inscrireParHttp, requete } from './aides.js'

function abonnement() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { endpoint: `https://fcm.googleapis.com/fcm/send/${randomBytes(6).toString('hex')}`, keys: { p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') } }
}

describe('notifications push par HTTP', () => {
  it("un joueur abonne son téléphone, règle ses choix, et reçoit l'annonce du MJ", async () => {
    const { app, cookieTom, campagneId, portail, pushs } = await appDeTest()
    const cookieLea = await inscrireParHttp(app, { campagneId, cookieProprietaire: cookieTom, identifiant: 'lea', role: 'joueur' })
    const appel = (cookie, method, url, payload) => requete(app, { method, url, cookie, payload })

    const reglages = (await appel(cookieLea, 'GET', '/api/moi/push')).json()
    expect(reglages.cle).toMatch(/^[A-Za-z0-9_-]{87}$/)
    expect(reglages.preferences.map((p) => p.cle)).toContain('annonces')
    expect((await appel(cookieLea, 'POST', '/api/moi/push', { abonnement: abonnement(), appareil: 'Android' })).statusCode).toBe(204)
    expect((await appel(cookieLea, 'PUT', '/api/moi/push/preferences', { actives: ['annonces'] })).statusCode).toBe(204)

    expect((await appel(cookieLea, 'POST', `/api/campagnes/${campagneId}/annonces`, { texte: 'x', destinataires: 'tous' })).statusCode).toBe(403)
    expect((await appel(cookieTom, 'POST', `/api/campagnes/${campagneId}/annonces`, { texte: 'Séance avancée.', destinataires: 'tous' })).statusCode).toBe(201)
    await portail.envoyerPushEnAttente()
    expect(pushs.map((p) => p.charge.texte)).toEqual(['Message de tom : Séance avancée.'])

    const [appareil] = (await appel(cookieLea, 'GET', '/api/moi/push')).json().appareils
    expect((await appel(cookieTom, 'DELETE', `/api/moi/push/appareils/${appareil.id}`)).statusCode).toBe(404)
    expect((await appel(cookieLea, 'DELETE', `/api/moi/push/appareils/${appareil.id}`)).statusCode).toBe(204)
  })

  it('refuse sans session', async () => {
    const { app } = await appDeTest()
    expect((await requete(app, { url: '/api/moi/push' })).statusCode).toBe(401)
  })
})
