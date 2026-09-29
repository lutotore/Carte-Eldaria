import { describe, expect, it } from 'vitest'
import { erreurIdentifiant, erreurMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from '../../src/domaine/identifiants.js'

describe('identifiant', () => {
  it.each(['tom', 'Tom_MJ', 'ilan.reve', 'joueur-2'])('accepte « %s »', (id) => {
    expect(erreurIdentifiant(id)).toBeNull()
  })

  it.each([
    ['', 'vide'],
    ['ab', 'trop court'],
    ['a'.repeat(33), 'trop long'],
    ['tom godard', 'espace'],
    ['tom@mail.fr', 'arobase'],
    ['éric', 'accent'],
  ])('refuse « %s » (%s)', (id) => {
    expect(erreurIdentifiant(id)).toMatch(/identifiant/i)
  })

  it('refuse ce qui n’est pas du texte', () => {
    expect(erreurIdentifiant(undefined)).not.toBeNull()
    expect(erreurIdentifiant(42)).not.toBeNull()
  })
})

describe('mot de passe', () => {
  it(`exige au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères`, () => {
    expect(erreurMotDePasse('a'.repeat(LONGUEUR_MIN_MOT_DE_PASSE - 1))).toMatch(/12/)
    expect(erreurMotDePasse('a'.repeat(LONGUEUR_MIN_MOT_DE_PASSE))).toBeNull()
  })

  it('compte les caractères et non les octets', () => {
    expect(erreurMotDePasse('éééééééééééé')).toBeNull()
  })

  it('borne la longueur pour éviter un hachage interminable', () => {
    expect(erreurMotDePasse('a'.repeat(257))).not.toBeNull()
  })

  it('refuse ce qui n’est pas du texte', () => {
    expect(erreurMotDePasse(null)).not.toBeNull()
  })
})
