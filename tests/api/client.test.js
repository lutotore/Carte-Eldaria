import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, appeler, envoyerPortrait, ErreurApi } from '../../src/api/client.js'

function repondre(statut, corps) {
  return vi.fn(async () => new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { 'Content-Type': 'application/json' },
  }))
}

describe("client de l'API", () => {
  afterEach(() => vi.unstubAllGlobals())

  it('envoie du JSON et renvoie la réponse décodée', async () => {
    const fetch = repondre(200, { ok: true })
    vi.stubGlobal('fetch', fetch)
    expect(await appeler('POST', '/api/session', { identifiant: 'tom' })).toEqual({ ok: true })
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/session')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe('{"identifiant":"tom"}')
  })

  it("n'annonce pas de JSON quand il n'y a pas de corps", async () => {
    const fetch = repondre(204)
    vi.stubGlobal('fetch', fetch)
    expect(await appeler('DELETE', '/api/session')).toBeNull()
    expect(fetch.mock.calls[0][1].headers['Content-Type']).toBeUndefined()
  })

  it("transforme une erreur de l'API en ErreurApi lisible", async () => {
    vi.stubGlobal('fetch', repondre(410, { code: 'lien_utilise', message: 'Ce lien a déjà servi.' }))
    const erreur = await appeler('GET', '/api/invitations/x').catch((e) => e)
    expect(erreur).toBeInstanceOf(ErreurApi)
    expect(erreur).toMatchObject({ statut: 410, code: 'lien_utilise', message: 'Ce lien a déjà servi.' })
  })

  it('signale un serveur injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const erreur = await appeler('GET', '/api/moi').catch((e) => e)
    expect(erreur).toMatchObject({ statut: 0, code: 'reseau' })
  })

  it('envoie le monde avec la version sur laquelle on a travaillé', async () => {
    const fetch = repondre(200, { version: 8 })
    vi.stubGlobal('fetch', fetch)
    expect(await api.enregistrerEtat(1, { horloge: 4 }, 7)).toEqual({ version: 8 })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ etat: { horloge: 4 }, version: 7 })
  })

  it("rattache un lieu à une île et partage un document", async () => {
    const fetch = repondre(204)
    vi.stubGlobal('fetch', fetch)
    await api.changerIle(1, 9, 'aeronis')
    await api.partager(1, 12)
    expect(fetch.mock.calls.map(([url, o]) => [o.method, url, o.body])).toEqual([
      ['PUT', '/api/campagnes/1/fiches/9/ile', '{"ile":"aeronis"}'],
      ['POST', '/api/campagnes/1/fiches/12/partage', undefined],
    ])
  })

  it('envoie un fichier tel quel et annonce les formats acceptés quand le serveur le refuse', async () => {
    vi.stubGlobal('fetch', repondre(415, { code: 'requete_invalide' }))
    const pdf = new Blob(['%PDF-'], { type: 'application/pdf' })
    const erreur = await envoyerPortrait(1, 12, pdf, true).catch((e) => e)
    expect(erreur.message).toBe('Formats acceptés : PNG, JPEG, WebP ou PDF.')
    const portrait = await envoyerPortrait(1, 9, pdf).catch((e) => e)
    expect(portrait.message).toBe('Formats acceptés : PNG, JPEG ou WebP.')
  })

  it('modifie une fiche de personnage champ par champ et prend dans un butin', async () => {
    const fetch = repondre(204)
    vi.stubGlobal('fetch', fetch)
    await api.modifierPersonnage(1, 4, { niveau: 2 })
    await api.changerBourse(1, 4, { po: 1 }, { po: 2 })
    await api.prendreObjet(1, 7, 9, 2)
    expect(fetch.mock.calls.map(([url, o]) => [o.method, url, JSON.parse(o.body)])).toEqual([
      ['PUT', '/api/campagnes/1/personnages/4', { champs: { niveau: 2 } }],
      ['PUT', '/api/campagnes/1/personnages/4/bourse', { avant: { po: 1 }, apres: { po: 2 } }],
      ['POST', '/api/campagnes/1/butins/7/objets/9/prise', { quantite: 2 }],
    ])
  })

  it('avance la date du monde et règle la date butoir', async () => {
    const fetch = repondre(204)
    vi.stubGlobal('fetch', fetch)
    await api.changerDate(1, 1170000)
    await api.changerButoir(1, { jour: 1170400, libelle: 'Le Grand Éveil', revele: false })
    expect(fetch.mock.calls.map(([url, o]) => [o.method, url, JSON.parse(o.body)])).toEqual([
      ['PUT', '/api/campagnes/1/calendrier/date', { jour: 1170000 }],
      ['PUT', '/api/campagnes/1/calendrier/butoir', { jour: 1170400, libelle: 'Le Grand Éveil', revele: false }],
    ])
  })
})
