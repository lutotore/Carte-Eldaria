import { describe, expect, it } from 'vitest'
import { campagneDe, estMj, estProprietaire, NOMS_ROLES } from '../../src/api/droits.js'

const moi = { identifiant: 'tom', campagnes: [{ id: 1, nom: 'Eldaria', role: 'proprietaire' }, { id: 2, nom: 'Autre', role: 'joueur' }] }

describe("droits vus par l'interface", () => {
  it('retrouve une campagne du compte par son numéro (texte ou nombre)', () => {
    expect(campagneDe(moi, '2')?.nom).toBe('Autre')
    expect(campagneDe(moi, 3)).toBeNull()
    expect(campagneDe(null, 1)).toBeNull()
  })

  it('reproduit les règles du serveur pour afficher les bons liens', () => {
    expect(estMj(campagneDe(moi, 1))).toBe(true)
    expect(estMj(campagneDe(moi, 2))).toBe(false)
    expect(estProprietaire(campagneDe(moi, 1))).toBe(true)
    expect(estProprietaire(campagneDe(moi, 2))).toBe(false)
  })

  it('nomme chaque rôle en français', () => {
    expect(NOMS_ROLES).toEqual({ proprietaire: 'MJ principal', mj: 'MJ', joueur: 'Joueur', occasionnel: 'Joueur occasionnel' })
  })
})
