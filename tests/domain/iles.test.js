import { describe, expect, it } from 'vitest'
import { altitudeCible, annulerChute, faireTomber, modifierIle, noterReleve, recalculerIles } from '../../src/domain/iles.js'
import { unMonde } from './fabrique.js'

describe('altitudeCible', () => {
  it("perd la vitesse de l'île par point d'Horloge au-delà du départ", () => {
    expect(altitudeCible({ altInit: 1200, vitesse: 25 }, 5, 3)).toBe(1150)
  })

  it("ne bouge pas quand l'Horloge est sous le départ", () => {
    expect(altitudeCible({ altInit: 1200, vitesse: 25 }, 1, 3)).toBe(1200)
  })
})

describe('noterReleve', () => {
  it('ajoute un relevé pour une nouvelle session', () => {
    expect(noterReleve([{ s: 'S1', alt: 10 }], 'S2', 8)).toEqual([{ s: 'S1', alt: 10 }, { s: 'S2', alt: 8 }])
  })

  it('met à jour le relevé de la session en cours au lieu de le dupliquer', () => {
    expect(noterReleve([{ s: 'S1', alt: 10 }], 'S1', 8)).toEqual([{ s: 'S1', alt: 8 }])
  })

  it("ne modifie pas l'historique reçu", () => {
    const historique = [{ s: 'S1', alt: 10 }]
    noterReleve(historique, 'S1', 8)
    expect(historique).toEqual([{ s: 'S1', alt: 10 }])
  })
})

describe('recalculerIles', () => {
  it('fait descendre les îles selon leur vitesse', () => {
    const { etat } = recalculerIles(unMonde({ horloge: 4, session: 'Session 2' }))
    expect(etat.iles.basse.alt).toBe(1175)
    expect(etat.iles.basse.historique.at(-1)).toEqual({ s: 'Session 2', alt: 1175 })
    expect(etat.iles.haute.alt).toBe(3000)
  })

  it("fait tomber une île qui atteint la brume, et l'annonce au MJ", () => {
    const { etat, tombees } = recalculerIles(unMonde({ horloge: 5 }))
    expect(tombees).toEqual(['basse'])
    expect(etat.iles.basse.statut).toBe('tombee')
    expect(etat.alertes.at(-1).titre).toBe('Basse est tombée')
    expect(etat.journal[0].texte).toBe('Basse est tombée dans la brume')
  })

  it("ne fait jamais remonter une île quand l'Horloge recule", () => {
    const apresMontee = recalculerIles(unMonde({ horloge: 4 })).etat
    const apresRecul = recalculerIles({ ...apresMontee, horloge: 3 }).etat
    expect(apresRecul.iles.basse.alt).toBe(1175)
  })

  it('garde le statut instable des îles qui tanguent', () => {
    expect(recalculerIles(unMonde({ horloge: 6 })).etat.iles.folle.statut).toBe('instable')
  })

  it("ne modifie pas l'état reçu", () => {
    const monde = unMonde({ horloge: 5 })
    recalculerIles(monde)
    expect(monde.iles.basse.alt).toBe(1200)
  })
})

describe('faireTomber / annulerChute', () => {
  it('fait tomber une île à la main et prépare une nouvelle', () => {
    const etat = faireTomber(unMonde(), 'haute')
    expect(etat.iles.haute.statut).toBe('tombee')
    expect(etat.alertes.at(-1).nouvelle.titre).toBe('Haute a disparu sous la brume')
  })

  it('annule une chute en replaçant l’île au-dessus de la brume', () => {
    const etat = annulerChute(faireTomber(unMonde(), 'basse'), 'basse')
    expect(etat.iles.basse.statut).toBe('descend')
    expect(etat.iles.basse.alt).toBeGreaterThan(1150)
  })
})

describe('modifierIle', () => {
  it('révèle une île et le note au journal', () => {
    const etat = modifierIle(unMonde(), 'secrete', 'revelee', true)
    expect(etat.iles.secrete.revelee).toBe(true)
    expect(etat.journal[0].texte).toBe('Secrète révélée aux joueurs')
  })

  it('accepte une vitesse écrite avec une virgule et recalcule', () => {
    const etat = modifierIle(unMonde({ horloge: 5 }), 'haute', 'vitesse', '2,5')
    expect(etat.iles.haute.vitesse).toBe(2.5)
    expect(etat.iles.haute.alt).toBe(2995)
  })

  it('refuse une vitesse négative ou un champ inconnu', () => {
    expect(() => modifierIle(unMonde(), 'haute', 'vitesse', '-1')).toThrow('positif')
    expect(() => modifierIle(unMonde(), 'haute', 'altInit', 5)).toThrow('non modifiable')
  })
})
