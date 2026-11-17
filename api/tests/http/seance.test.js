import { describe, expect, it } from 'vitest'
import { appDeTest, inscrireParHttp, requete } from './aides.js'

async function avecScenes() {
  const outils = await appDeTest()
  const { app, cookieTom, campagneId, portail } = outils
  const cookieLea = await inscrireParHttp(app, { campagneId, cookieProprietaire: cookieTom, identifiant: 'lea', role: 'joueur' })
  portail.importerScenes(campagneId, {
    fiches: [{ type: 'creature', nom: 'Fileur de brume', facettes: { description: 'Une ombre.' } }, { type: 'pnj', nom: 'Crouvier', facettes: { role: 'Contremaître' } }],
    scenes: [{ titre: 'Le Nid', elements: [{ type: 'creature', nom: 'Fileur de brume' }, { type: 'pnj', nom: 'Crouvier', facettes: ['nom'] }] }],
  })
  const base = `/api/campagnes/${campagneId}`
  return { ...outils, cookieLea, base }
}

describe('pupitre de séance par HTTP', () => {
  it('liste les scènes pour un MJ seulement', async () => {
    const { app, cookieTom, cookieLea, base } = await avecScenes()
    const lu = await requete(app, { url: `${base}/scenes`, cookie: cookieTom })
    expect(lu.statusCode).toBe(200)
    expect(lu.json().scenes[0]).toMatchObject({ titre: 'Le Nid', elements: [{ nom: 'Fileur de brume', etat: 'cache' }, { nom: 'Crouvier' }] })
    expect((await requete(app, { url: `${base}/scenes`, cookie: cookieLea })).statusCode).toBe(403)
  })

  it('révèle une scène, ou un élément, et le joueur le voit', async () => {
    const { app, cookieTom, cookieLea, base } = await avecScenes()
    const sceneId = (await requete(app, { url: `${base}/scenes`, cookie: cookieTom })).json().scenes[0].id
    const un = await requete(app, { method: 'POST', url: `${base}/scenes/${sceneId}/revelation`, cookie: cookieTom, payload: { element: 1, pourTous: true, joueurs: [] } })
    expect(un.statusCode).toBe(204)
    expect((await requete(app, { url: `${base}/bibliotheque?type=pnj`, cookie: cookieLea })).json().fiches).toHaveLength(1)
    expect((await requete(app, { url: `${base}/bibliotheque?type=creature`, cookie: cookieLea })).json().fiches).toHaveLength(0)
    await requete(app, { method: 'POST', url: `${base}/scenes/${sceneId}/revelation`, cookie: cookieTom, payload: { pourTous: true, joueurs: [] } })
    expect((await requete(app, { url: `${base}/bibliotheque?type=creature`, cookie: cookieLea })).json().fiches).toHaveLength(1)
  })

  it('révèle plusieurs fiches de la bibliothèque d’un coup', async () => {
    const { app, cookieTom, cookieLea, base } = await avecScenes()
    const fiches = (await requete(app, { url: `${base}/bibliotheque?type=pnj`, cookie: cookieTom })).json().fiches.map((f) => f.id)
    const reponse = await requete(app, { method: 'POST', url: `${base}/revelations`, cookie: cookieTom, payload: { fiches, pourTous: true, joueurs: [] } })
    expect(reponse.statusCode).toBe(204)
    expect((await requete(app, { url: `${base}/bibliotheque?type=pnj`, cookie: cookieLea })).json().fiches[0].nom).toBe('Crouvier')
  })

  it('ajoute une note de séance au Journal', async () => {
    const { app, cookieTom, base } = await avecScenes()
    const reponse = await requete(app, { method: 'POST', url: `${base}/journal`, cookie: cookieTom, payload: { texte: 'Tam a pris la pioche.' } })
    expect(reponse.statusCode).toBe(200)
    expect(reponse.json().version).toBeGreaterThan(1)
    expect((await requete(app, { url: `${base}/etat`, cookie: cookieTom })).json().etat.journal[0].texte).toBe('Tam a pris la pioche.')
  })

  it('donne le fil « Quoi de neuf » à un joueur, puis le marque comme vu', async () => {
    const { app, cookieTom, cookieLea, base } = await avecScenes()
    const sceneId = (await requete(app, { url: `${base}/scenes`, cookie: cookieTom })).json().scenes[0].id
    await requete(app, { method: 'POST', url: `${base}/scenes/${sceneId}/revelation`, cookie: cookieTom, payload: { pourTous: true, joueurs: [] } })
    const fil = (await requete(app, { url: `${base}/nouveautes`, cookie: cookieLea })).json()
    expect(fil.liste[0]).toMatchObject({ categorie: 'revelations', lue: false })
    expect((await requete(app, { method: 'POST', url: `${base}/nouveautes/lues`, cookie: cookieLea })).statusCode).toBe(204)
    expect((await requete(app, { url: `${base}/nouveautes`, cookie: cookieLea })).json().liste[0].lue).toBe(true)
  })
})
