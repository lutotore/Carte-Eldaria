import { describe, expect, it } from 'vitest'
import { additionner, erreurButin, erreurMarque, erreurObjetButin, erreurPrisePieces, partDesPieces, retirer, STATUTS_BUTIN } from '../../src/domain/butins.js'

const bourse = (x = {}) => ({ pp: 0, po: 0, pe: 0, pa: 0, pc: 0, ...x })

describe('butins', () => {
  it('se préparent, s’ouvrent aux joueurs, puis se ferment', () => {
    expect(STATUTS_BUTIN).toEqual(['prepare', 'ouvert', 'clos'])
  })

  it('ont un titre, des notes du MJ et des pièces', () => {
    expect(erreurButin({ titre: 'La chapelle', notesMj: '', pieces: bourse({ po: 50 }) })).toBeNull()
    expect(erreurButin({ titre: ' ', notesMj: '', pieces: bourse() })).not.toBeNull()
    expect(erreurButin({ titre: 'x', notesMj: 'y'.repeat(20001), pieces: bourse() })).not.toBeNull()
    expect(erreurButin({ titre: 'x', notesMj: '', pieces: { po: 1 } })).not.toBeNull()
  })

  it('contiennent des objets : un libellé vu des joueurs, une quantité, une description', () => {
    expect(erreurObjetButin({ libelle: 'Potion de soins', quantite: 4, description: '' })).toBeNull()
    expect(erreurObjetButin({ libelle: '', quantite: 1, description: '' })).not.toBeNull()
    expect(erreurObjetButin({ libelle: 'Potion', quantite: 0, description: '' })).not.toBeNull()
    // Un objet entièrement pris reste à 0 : on peut encore corriger son libellé.
    expect(erreurObjetButin({ libelle: 'Potion', quantite: 0, description: '' }, { minimum: 0 })).toBeNull()
  })
})

describe('prendre des pièces', () => {
  it('se limite à ce qui reste dans le butin, et au moins une pièce', () => {
    const reste = bourse({ po: 20, pa: 5 })
    expect(erreurPrisePieces(reste, bourse({ po: 5 }))).toBeNull()
    expect(erreurPrisePieces(reste, bourse({ po: 21 }))).toMatch(/reste/)
    expect(erreurPrisePieces(reste, bourse())).toMatch(/aucune/i)
    expect(erreurPrisePieces(reste, { po: 1 })).not.toBeNull()
  })

  it('passe les pièces du butin à la bourse', () => {
    expect(retirer(bourse({ po: 20, pa: 5 }), bourse({ po: 5, pa: 5 }))).toEqual(bourse({ po: 15 }))
    expect(additionner(bourse({ po: 3 }), bourse({ po: 5, pc: 2 }))).toEqual(bourse({ po: 8, pc: 2 }))
  })
})

describe('prendre sa part', () => {
  const bourse = (x = {}) => ({ pp: 0, po: 0, pe: 0, pa: 0, pc: 0, ...x })

  it('partage ce qui reste entre ceux qui ne se sont pas encore servis, à l’arrondi inférieur', () => {
    expect(partDesPieces(bourse({ po: 40 }), 8)).toEqual(bourse({ po: 5 }))
    expect(partDesPieces(bourse({ po: 41, pa: 3 }), 8)).toEqual(bourse({ po: 5 }))
  })

  it('donne tout le reste au dernier, pour que rien ne se perde', () => {
    expect(partDesPieces(bourse({ po: 6, pa: 3 }), 1)).toEqual(bourse({ po: 6, pa: 3 }))
  })

  it("n'existe plus quand tout le monde s'est servi", () => {
    expect(partDesPieces(bourse({ po: 6 }), 0)).toBeNull()
  })
})

describe('Marques du Rêve', () => {
  it('ont un nom, un don et un prix', () => {
    expect(erreurMarque({ titre: 'La Marque du Cœur', don: 'Voir dans le noir.', prix: 'Rêve chaque nuit de la mine.' })).toBeNull()
    expect(erreurMarque({ titre: '', don: 'x', prix: 'y' })).not.toBeNull()
    expect(erreurMarque({ titre: 'x', don: 'd'.repeat(4001), prix: '' })).not.toBeNull()
  })
})
