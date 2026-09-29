import { describe, expect, it } from 'vitest'
import { etatDuLien, expirationDans } from '../../src/domaine/liens.js'

const LUNDI = new Date('2026-10-05T20:00:00Z')

describe('liens à usage unique (invitation, réinitialisation)', () => {
  it('calcule une expiration à N jours', () => {
    expect(expirationDans(LUNDI, 7).toISOString()).toBe('2026-10-12T20:00:00.000Z')
  })

  it('est valide avant son expiration', () => {
    expect(etatDuLien({ expireLe: '2026-10-12T20:00:00.000Z', utiliseLe: null }, LUNDI)).toBe('valide')
  })

  it('expire à l’instant prévu', () => {
    expect(etatDuLien({ expireLe: LUNDI.toISOString(), utiliseLe: null }, LUNDI)).toBe('expire')
  })

  it('ne sert qu’une fois, même avant expiration', () => {
    expect(etatDuLien({ expireLe: '2026-10-12T20:00:00.000Z', utiliseLe: '2026-10-06T10:00:00.000Z' }, LUNDI)).toBe('utilise')
  })

  it("signale un lien inconnu", () => {
    expect(etatDuLien(null, LUNDI)).toBe('inconnu')
  })
})
