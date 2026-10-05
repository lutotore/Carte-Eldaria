import { describe, expect, it } from 'vitest'
import { appDeTest, inscrireParHttp, ORIGINE, requete } from './aides.js'

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)])

async function avecFiche() {
  const outils = await appDeTest()
  const { app, cookieTom, campagneId } = outils
  const cookieLea = await inscrireParHttp(app, { campagneId, cookieProprietaire: cookieTom, identifiant: 'lea', role: 'joueur' })
  const base = `/api/campagnes/${campagneId}`
  const creation = await requete(app, { method: 'POST', url: `${base}/fiches`, cookie: cookieTom, payload: { nom: 'Pip Cordelune' } })
  const { ficheId } = creation.json()
  const fiche = (await requete(app, { url: `${base}/fiches/${ficheId}`, cookie: cookieTom })).json()
  const facette = (cle) => fiche.facettes.find((f) => f.cle === cle)
  const envoyerImage = (octets, type = 'image/png', cookie = cookieTom) => app.inject({
    method: 'PUT', url: `${base}/fiches/${ficheId}/portrait`, payload: octets, headers: { origin: ORIGINE, cookie, 'content-type': type },
  })
  return { ...outils, cookieLea, base, ficheId, facette, envoyerImage, creation }
}

describe('bibliothèque par HTTP', () => {
  it('crée une fiche, révèle une facette, le joueur la voit', async () => {
    const { app, cookieTom, cookieLea, base, ficheId, facette, creation } = await avecFiche()
    expect(creation.statusCode).toBe(201)
    expect((await requete(app, { url: `${base}/fiches/${ficheId}`, cookie: cookieLea })).statusCode).toBe(404)

    const revelation = await requete(app, { method: 'PUT', url: `${base}/fiches/${ficheId}/facettes/${facette('nom').id}/revelation`, cookie: cookieTom, payload: { pourTous: true, joueurs: [] } })
    expect(revelation.statusCode).toBe(204)
    const vue = await requete(app, { url: `${base}/fiches/${ficheId}`, cookie: cookieLea })
    expect(vue.json()).toMatchObject({ estMj: false, fiche: { nom: 'Pip Cordelune' } })
    expect((await requete(app, { url: `${base}/bibliotheque`, cookie: cookieLea })).json().fiches).toHaveLength(1)
  })

  it('téléverse un portrait (PNG brut) et le sert selon les droits', async () => {
    const { app, cookieTom, cookieLea, base, ficheId, facette, envoyerImage } = await avecFiche()
    const envoi = await envoyerImage(PNG)
    expect(envoi.statusCode).toBe(200)
    const { imageId } = envoi.json()

    const pourMj = await requete(app, { url: `${base}/images/${imageId}`, cookie: cookieTom })
    expect(pourMj.statusCode).toBe(200)
    expect(pourMj.headers['content-type']).toBe('image/png')
    expect(pourMj.headers['cache-control']).toBe('private, max-age=86400')
    expect(pourMj.rawPayload.equals(PNG)).toBe(true)

    expect((await requete(app, { url: `${base}/images/${imageId}`, cookie: cookieLea })).statusCode).toBe(404)
    await requete(app, { method: 'PUT', url: `${base}/fiches/${ficheId}/facettes/${facette('portrait').id}/revelation`, cookie: cookieTom, payload: { pourTous: true, joueurs: [] } })
    expect((await requete(app, { url: `${base}/images/${imageId}`, cookie: cookieLea })).statusCode).toBe(200)
  })

  it('refuse un faux PNG, un type non image et un joueur', async () => {
    const { envoyerImage, cookieLea } = await avecFiche()
    expect((await envoyerImage(Buffer.from('<svg/>'), 'image/png')).statusCode).toBe(400)
    expect((await envoyerImage(Buffer.from('<svg/>'), 'image/svg+xml')).statusCode).toBe(415)
    expect((await envoyerImage(PNG, 'image/png', cookieLea)).statusCode).toBe(403)
  })

  it('refuse un identifiant d’image fantaisiste', async () => {
    const { app, cookieTom, base } = await avecFiche()
    expect((await requete(app, { url: `${base}/images/..%2F..%2Fetc%2Fpasswd`, cookie: cookieTom })).statusCode).toBe(404)
  })

  it('notes et croyances, puis comptage par le MJ', async () => {
    const { app, cookieTom, cookieLea, base, ficheId, facette } = await avecFiche()
    await requete(app, { method: 'PUT', url: `${base}/fiches/${ficheId}/facettes/${facette('nom').id}/revelation`, cookie: cookieTom, payload: { pourTous: true, joueurs: [] } })
    const ajout = await requete(app, { method: 'POST', url: `${base}/fiches/${ficheId}/notes`, cookie: cookieLea, payload: { type: 'croyance', visibilite: 'groupe', texte: 'Il rêve trop.' } })
    expect(ajout.statusCode).toBe(201)
    const { noteId } = ajout.json()
    const etatAvant = (await requete(app, { url: `${base}/etat`, cookie: cookieTom })).json().etat
    etatAvant.croyances = { fleau: 0, monde: 0, fusion: 0 }
    etatAvant.regles.lectures = [{ cle: 'monde', nom: 'Le Monde blessé' }]
    const { version } = (await requete(app, { url: `${base}/etat`, cookie: cookieTom })).json()
    await requete(app, { method: 'PUT', url: `${base}/etat`, cookie: cookieTom, payload: { etat: etatAvant, version } })

    const comptage = await requete(app, { method: 'POST', url: `${base}/notes/${noteId}/comptage`, cookie: cookieTom, payload: { lecture: 'monde' } })
    expect(comptage.statusCode).toBe(204)
    expect((await requete(app, { url: `${base}/etat`, cookie: cookieTom })).json().etat.croyances.monde).toBe(1)
    expect((await requete(app, { method: 'DELETE', url: `${base}/notes/${noteId}`, cookie: cookieLea })).statusCode).toBe(204)
  })
})

describe('bestiaire par HTTP', () => {
  it('crée une créature, ajoute une action, révèle tout, et les joueurs estiment', async () => {
    const { app, cookieTom, cookieLea, base } = await avecFiche()
    const creation = await requete(app, { method: 'POST', url: `${base}/fiches`, cookie: cookieTom, payload: { nom: 'Stryge', type: 'creature' } })
    expect(creation.statusCode).toBe(201)
    const { ficheId } = creation.json()
    const ajout = await requete(app, { method: 'POST', url: `${base}/fiches/${ficheId}/elements`, cookie: cookieTom, payload: { cle: 'action', titre: 'Absorption', texte: 'Elle s’accroche.' } })
    expect(ajout.statusCode).toBe(201)

    const liste = await requete(app, { url: `${base}/bibliotheque?type=creature`, cookie: cookieTom })
    expect(liste.json().fiches.map((f) => f.nom)).toEqual(['Stryge'])

    expect((await requete(app, { method: 'POST', url: `${base}/fiches/${ficheId}/revelation-totale`, cookie: cookieTom })).statusCode).toBe(204)
    const estimation = await requete(app, { method: 'PUT', url: `${base}/fiches/${ficheId}/estimations/ca`, cookie: cookieLea, payload: { texte: 'autour de 14' } })
    expect(estimation.statusCode).toBe(204)
    const vue = (await requete(app, { url: `${base}/fiches/${ficheId}`, cookie: cookieLea })).json()
    expect(vue.grille.find((l) => l.cle === 'ca').estimation.texte).toBe('autour de 14')
    expect(vue.fiche.facettes.map((f) => f.cle)).toEqual(['action'])
  })

  it('refuse un type inconnu dans la liste', async () => {
    const { app, cookieTom, base } = await avecFiche()
    expect((await requete(app, { url: `${base}/bibliotheque?type=dragon`, cookie: cookieTom })).statusCode).toBe(400)
  })
})

describe('documents par HTTP', () => {
  it('téléverse un PDF, le sert en téléchargement, et le joueur le partage', async () => {
    const { app, cookieTom, cookieLea, base } = await avecFiche()
    const { ficheId } = (await requete(app, { method: 'POST', url: `${base}/fiches`, cookie: cookieTom, payload: { nom: 'Lettre', type: 'document' } })).json()
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(32, 2)])
    const envoi = await app.inject({ method: 'PUT', url: `${base}/fiches/${ficheId}/portrait`, payload: pdf, headers: { origin: ORIGINE, cookie: cookieTom, 'content-type': 'application/pdf' } })
    expect(envoi.statusCode).toBe(200)
    const telechargement = await requete(app, { url: `${base}/images/${envoi.json().imageId}`, cookie: cookieTom })
    expect(telechargement.headers['content-type']).toBe('application/pdf')
    expect(telechargement.headers['content-disposition']).toMatch(/^attachment/)

    const fiche = (await requete(app, { url: `${base}/fiches/${ficheId}`, cookie: cookieTom })).json()
    const leaId = fiche.joueurs.find((j) => j.identifiant === 'lea').id
    const nom = fiche.facettes.find((f) => f.cle === 'nom')
    await requete(app, { method: 'PUT', url: `${base}/fiches/${ficheId}/facettes/${nom.id}/revelation`, cookie: cookieTom, payload: { pourTous: false, joueurs: [leaId] } })
    expect((await requete(app, { method: 'POST', url: `${base}/fiches/${ficheId}/partage`, cookie: cookieLea })).statusCode).toBe(204)
  })

  it("rattache un lieu à une île", async () => {
    const { app, cookieTom, base } = await avecFiche()
    const { ficheId } = (await requete(app, { method: 'POST', url: `${base}/fiches`, cookie: cookieTom, payload: { nom: 'Le Pic', type: 'lieu' } })).json()
    expect((await requete(app, { method: 'PUT', url: `${base}/fiches/${ficheId}/ile`, cookie: cookieTom, payload: { ile: 'aeronis' } })).statusCode).toBe(204)
    expect((await requete(app, { url: `${base}/fiches/${ficheId}`, cookie: cookieTom })).json().ile).toBe('aeronis')
  })
})

