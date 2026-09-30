import { describe, expect, it } from 'vitest'
import { appDeTest, inscrireParHttp, requete } from './aides.js'

describe('planification des séances par HTTP', () => {
  it('sondage, réponse, séance fixée, notifications', async () => {
    const { app, cookieTom, campagneId } = await appDeTest()
    const cookieLea = await inscrireParHttp(app, { campagneId, cookieProprietaire: cookieTom, identifiant: 'lea', role: 'joueur' })
    const base = `/api/campagnes/${campagneId}`

    const ouverture = await requete(app, { method: 'POST', url: `${base}/sondages`, cookie: cookieTom, payload: { dates: ['2026-10-10', '2026-10-17'], lieu: 'Chez Tom' } })
    expect(ouverture.statusCode).toBe(201)
    const { sondageId } = ouverture.json()

    const vueLea = (await requete(app, { url: `${base}/planning`, cookie: cookieLea })).json()
    const [d1] = vueLea.sondage.dates
    const reponse = await requete(app, {
      method: 'PUT', url: `${base}/sondages/${sondageId}/reponses`, cookie: cookieLea,
      payload: { reponses: [{ dateId: d1.id, disponible: true, debut: '14:00', fin: '23:00' }] },
    })
    expect(reponse.statusCode).toBe(204)

    const refus = await requete(app, { method: 'POST', url: `${base}/sondages/${sondageId}/seance`, cookie: cookieLea, payload: { dateId: d1.id, debut: '14:00', fin: '23:00' } })
    expect(refus.statusCode).toBe(403)

    const fixation = await requete(app, { method: 'POST', url: `${base}/sondages/${sondageId}/seance`, cookie: cookieTom, payload: { dateId: d1.id, debut: '14:00', fin: '23:00' } })
    expect(fixation.statusCode).toBe(201)

    const notifications = (await requete(app, { url: '/api/notifications', cookie: cookieLea })).json()
    expect(notifications.nonLues).toBe(2)
    expect(notifications.liste[0].texte).toBe('Séance fixée : samedi 10 octobre 2026, de 14 h à 23 h.')
    expect((await requete(app, { method: 'POST', url: '/api/notifications/lues', cookie: cookieLea })).statusCode).toBe(204)
    expect((await requete(app, { url: '/api/notifications', cookie: cookieLea })).json().nonLues).toBe(0)

    const planning = (await requete(app, { url: `${base}/planning`, cookie: cookieLea })).json()
    expect(planning).toMatchObject({ campagne: 'Eldaria', sondage: null, prochaineSeance: { jour: '2026-10-10', debut: 840, fin: 1380, lieu: 'Chez Tom' } })

    const annulation = await requete(app, { method: 'DELETE', url: `${base}/seances/${planning.prochaineSeance.id}`, cookie: cookieTom })
    expect(annulation.statusCode).toBe(204)
  })

  it('exige une session', async () => {
    const { app, campagneId } = await appDeTest()
    expect((await requete(app, { url: `/api/campagnes/${campagneId}/planning` })).statusCode).toBe(401)
    expect((await requete(app, { url: '/api/notifications' })).statusCode).toBe(401)
  })
})
