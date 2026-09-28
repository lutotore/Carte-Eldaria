import { describe, expect, it } from 'vitest'
import { changerStatutMission } from '../../src/domain/missions.js'
import { unMonde } from './fabrique.js'

describe('changerStatutMission', () => {
  it('terminer une expédition coûte +1 à l’Horloge', () => {
    const etat = changerStatutMission(unMonde(), 'expe', 'terminee')
    expect(etat.missions.expe.statut).toBe('terminee')
    expect(etat.horloge).toBe(4)
  })

  it('ne fait payer une expédition qu’une seule fois', () => {
    let etat = changerStatutMission(unMonde(), 'expe', 'terminee')
    etat = changerStatutMission(etat, 'expe', 'en_cours')
    etat = changerStatutMission(etat, 'expe', 'terminee')
    expect(etat.horloge).toBe(4)
  })

  it('terminer une mission principale ne touche pas l’Horloge', () => {
    expect(changerStatutMission(unMonde(), 'principale', 'terminee').horloge).toBe(3)
  })

  it('refuse un statut inconnu', () => {
    expect(() => changerStatutMission(unMonde(), 'expe', 'abandonnee')).toThrow('Statut inconnu')
  })
})
