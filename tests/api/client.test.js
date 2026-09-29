import { afterEach, describe, expect, it, vi } from 'vitest'
import { appeler, ErreurApi } from '../../src/api/client.js'

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
})
