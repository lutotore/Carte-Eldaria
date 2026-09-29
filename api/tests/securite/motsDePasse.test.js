import { describe, expect, it } from 'vitest'
import { hacherMotDePasse, verifierMotDePasse } from '../../src/securite/motsDePasse.js'

// Coût réduit : les tests restent rapides, la production garde le coût fort.
const RAPIDE = { N: 1024 }

describe('mots de passe', () => {
  it('ne stocke jamais le mot de passe en clair', async () => {
    const empreinte = await hacherMotDePasse('une phrase de passe', RAPIDE)
    expect(empreinte).not.toContain('une phrase de passe')
    expect(empreinte.startsWith('scrypt$')).toBe(true)
  })

  it('reconnaît le bon mot de passe', async () => {
    const empreinte = await hacherMotDePasse('une phrase de passe', RAPIDE)
    expect(await verifierMotDePasse('une phrase de passe', empreinte)).toBe(true)
  })

  it('refuse un mauvais mot de passe', async () => {
    const empreinte = await hacherMotDePasse('une phrase de passe', RAPIDE)
    expect(await verifierMotDePasse('une phrase de passf', empreinte)).toBe(false)
  })

  it('sale chaque empreinte : deux hachages du même mot de passe diffèrent', async () => {
    const a = await hacherMotDePasse('identique', RAPIDE)
    const b = await hacherMotDePasse('identique', RAPIDE)
    expect(a).not.toBe(b)
  })

  it('vérifie avec les paramètres enregistrés dans l’empreinte, pas ceux du moment', async () => {
    const ancienne = await hacherMotDePasse('ancien coût', { N: 2048 })
    expect(await verifierMotDePasse('ancien coût', ancienne)).toBe(true)
  })

  it('refuse une empreinte illisible sans planter', async () => {
    expect(await verifierMotDePasse('x', 'nimportequoi')).toBe(false)
  })
})
