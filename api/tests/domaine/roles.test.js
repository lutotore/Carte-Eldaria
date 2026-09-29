import { describe, expect, it } from 'vitest'
import { estMj, peutGererMembres, ROLES, ROLES_INVITABLES } from '../../src/domaine/roles.js'

describe('rôles dans une campagne', () => {
  it('connaît les quatre rôles', () => {
    expect(ROLES).toEqual(['proprietaire', 'mj', 'joueur', 'occasionnel'])
  })

  it('donne les droits de MJ au propriétaire et aux MJ seulement', () => {
    expect(estMj('proprietaire')).toBe(true)
    expect(estMj('mj')).toBe(true)
    expect(estMj('joueur')).toBe(false)
    expect(estMj('occasionnel')).toBe(false)
    expect(estMj(undefined)).toBe(false)
  })

  it('réserve la gestion des membres au propriétaire', () => {
    expect(peutGererMembres('proprietaire')).toBe(true)
    expect(peutGererMembres('mj')).toBe(false)
    expect(peutGererMembres('joueur')).toBe(false)
  })

  it("n'autorise pas à inviter quelqu'un comme propriétaire", () => {
    expect(ROLES_INVITABLES).toEqual(['mj', 'joueur', 'occasionnel'])
  })
})
