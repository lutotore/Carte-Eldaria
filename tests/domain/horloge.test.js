import { describe, expect, it } from 'vitest'
import { appliquerEvenement, changerHorloge } from '../../src/domain/horloge.js'
import { unMonde } from './fabrique.js'

describe('changerHorloge', () => {
  it('avance, journalise avec le delta et recalcule les îles', () => {
    const { etat, change } = changerHorloge(unMonde(), 1, 'Test')
    expect(change).toBe(true)
    expect(etat.horloge).toBe(4)
    expect(etat.journal[0]).toEqual({ t: 'Session 1', texte: 'Test', d: 1 })
    expect(etat.iles.basse.alt).toBe(1175)
  })

  it('reste bornée entre 0 et le maximum', () => {
    expect(changerHorloge(unMonde({ horloge: 20 }), 3).change).toBe(false)
    expect(changerHorloge(unMonde({ horloge: 1 }), -5).etat.horloge).toBe(0)
  })

  it('signale chaque seuil franchi une seule fois, avec sa nouvelle', () => {
    const premiere = changerHorloge(unMonde(), 2).etat
    expect(premiere.seuilsVus).toEqual([5])
    expect(premiere.alertes.find((a) => a.titre.startsWith('Seuil 5')).nouvelle.titre).toBe('Rumeur')

    const aller = changerHorloge(changerHorloge(premiere, -1).etat, 1).etat
    expect(aller.alertes.filter((a) => a.titre.startsWith('Seuil 5'))).toHaveLength(1)
  })

  it('signale plusieurs seuils franchis d’un coup', () => {
    expect(changerHorloge(unMonde(), 6).etat.seuilsVus).toEqual([5, 8])
  })
})

describe('appliquerEvenement', () => {
  it("applique le delta de l'événement avec son libellé", () => {
    const { etat } = appliquerEvenement(unMonde(), 1)
    expect(etat.horloge).toBe(1)
    expect(etat.journal[0].texte).toBe('Moratoire')
  })

  it('refuse un événement inconnu', () => {
    expect(() => appliquerEvenement(unMonde(), 9)).toThrow('inconnu')
  })
})
