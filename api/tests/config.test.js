import { describe, expect, it } from 'vitest'
import { lireConfig } from '../src/config.js'

describe('configuration', () => {
  it('exige l’adresse publique du site', () => {
    expect(() => lireConfig({})).toThrow(/ORIGINE/)
    expect(() => lireConfig({ ORIGINE: 'eldaria.fr' })).toThrow(/ORIGINE/)
  })

  it('active le cookie sécurisé en HTTPS et retire la barre finale', () => {
    const config = lireConfig({ ORIGINE: 'https://eldaria.exemple.fr/' })
    expect(config.origine).toBe('https://eldaria.exemple.fr')
    expect(config.cookieSecurise).toBe(true)
  })

  it('reste utilisable en local sans HTTPS', () => {
    expect(lireConfig({ ORIGINE: 'http://localhost:5173' }).cookieSecurise).toBe(false)
  })
})
