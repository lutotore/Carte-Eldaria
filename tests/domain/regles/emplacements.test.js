import { describe, expect, it } from 'vitest'
import { emplacements } from '../../../src/domain/regles/emplacements.js'
import { srd } from './aides.js'

const cat = srd()
const regles = (...classes) => ({ classes: classes.map(([classe, niveau]) => ({ classe, niveau, sousClasse: null })) })

describe('emplacements de sorts', () => {
  it('suit la table des lanceurs complets', () => {
    expect(emplacements(regles(['magicien', 1]), cat).sorts).toEqual([2])
    expect(emplacements(regles(['magicien', 5]), cat).sorts).toEqual([4, 3, 2])
    expect(emplacements(regles(['clerc', 20]), cat).sorts).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1])
  })

  it('donne rien au paladin de niveau 1, puis la moitié arrondie au supérieur', () => {
    expect(emplacements(regles(['paladin', 1]), cat).sorts).toEqual([])
    expect(emplacements(regles(['paladin', 2]), cat).sorts).toEqual([2])
    expect(emplacements(regles(['rodeur', 5]), cat).sorts).toEqual([4, 2])
  })

  it('ne donne rien aux classes sans incantation', () => {
    expect(emplacements(regles(['guerrier', 10]), cat)).toEqual({ sorts: [], pacte: null })
  })

  it('compte à part la magie de pacte de l’occultiste', () => {
    expect(emplacements(regles(['occultiste', 1]), cat)).toEqual({ sorts: [], pacte: { nombre: 1, niveau: 1 } })
    expect(emplacements(regles(['occultiste', 5]), cat).pacte).toEqual({ nombre: 2, niveau: 3 })
    expect(emplacements(regles(['occultiste', 11]), cat).pacte).toEqual({ nombre: 3, niveau: 5 })
    expect(emplacements(regles(['occultiste', 17]), cat).pacte).toEqual({ nombre: 4, niveau: 5 })
  })

  it('additionne les niveaux de lanceur en multiclasse : demi-lanceurs arrondis à l’inférieur', () => {
    expect(emplacements(regles(['clerc', 3], ['paladin', 2]), cat).sorts).toEqual([4, 3])
    expect(emplacements(regles(['clerc', 3], ['paladin', 1]), cat).sorts).toEqual([4, 2])
    expect(emplacements(regles(['clerc', 3], ['occultiste', 2]), cat)).toEqual({ sorts: [4, 2], pacte: { nombre: 2, niveau: 1 } })
  })
})
