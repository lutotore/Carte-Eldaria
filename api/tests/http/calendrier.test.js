import { describe, expect, it } from 'vitest'
import { DATE_DE_DEPART } from '../../../src/domain/calendrier.js'
import { appDeTest, inscrireParHttp, requete } from './aides.js'

describe('calendrier par HTTP', () => {
  it('le MJ avance la date et note un événement caché ; le joueur voit la date sur la carte, pas le secret', async () => {
    const { app, cookieTom, campagneId } = await appDeTest()
    const cookieLea = await inscrireParHttp(app, { campagneId, cookieProprietaire: cookieTom, identifiant: 'lea', role: 'joueur' })
    const appel = (cookie, method, chemin, payload) => requete(app, { method, url: `/api/campagnes/${campagneId}${chemin}`, cookie, payload })

    expect((await appel(cookieTom, 'PUT', '/calendrier/date', { jour: DATE_DE_DEPART + 1 })).statusCode).toBe(204)
    const secret = await appel(cookieTom, 'POST', '/calendrier/evenements', { type: 'evenement', jour: DATE_DE_DEPART + 90, duree: 1, annuel: false, titre: 'Chute', description: '', visibilite: 'cache' })
    expect(secret.statusCode).toBe(201)
    expect((await appel(cookieTom, 'PUT', '/calendrier/butoir', { jour: DATE_DE_DEPART + 500, libelle: 'Le Grand Éveil', revele: false })).statusCode).toBe(204)

    const vue = (await appel(cookieLea, 'GET', '/calendrier')).json()
    expect(vue).toMatchObject({ estMj: false, aujourdhui: DATE_DE_DEPART + 1, butoir: null })
    expect(vue.evenements.map((e) => e.titre)).not.toContain('Chute')
    expect((await appel(cookieLea, 'GET', '/monde')).json().date.texte).toBe('4 Longue-Vue 3207 AE')
    expect((await appel(cookieLea, 'PUT', '/calendrier/date', { jour: 0 })).statusCode).toBe(403)
    expect((await appel(cookieLea, 'POST', '/calendrier/evenements', { type: 'note', jour: 5, titre: 'RDV', visibilite: 'privee', demandeurId: 1 })).statusCode).toBe(201)
  })
})
