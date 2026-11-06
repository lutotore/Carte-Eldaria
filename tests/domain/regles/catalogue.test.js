import { describe, expect, it } from 'vitest'
import { creerCatalogue, erreurCatalogue } from '../../../src/domain/regles/catalogue.js'
import { ELEMENTS_SRD } from '../../../src/domain/regles/srd.js'
import { srd } from './aides.js'

describe('données du SRD', () => {
  const cat = srd()

  it('a les douze classes, chacune avec au moins une sous-classe', () => {
    expect(cat.classes().map((c) => c.id)).toEqual([
      'barbare', 'barde', 'clerc', 'druide', 'ensorceleur', 'guerrier', 'magicien', 'moine', 'occultiste', 'paladin', 'rodeur', 'roublard',
    ])
    for (const classe of cat.classes()) expect(cat.sousClassesDe(classe.id).length, classe.id).toBeGreaterThan(0)
  })

  it('ne renvoie qu’à des listes qui existent, et à des niveaux entre 1 et 20', () => {
    const tables = [...cat.classes(), ...cat.classes().flatMap((c) => cat.sousClassesDe(c.id))]
    for (const element of tables) {
      for (const [niveau, choix] of Object.entries(element.choix ?? {})) {
        expect(Number(niveau)).toBeGreaterThanOrEqual(1)
        for (const c of choix) if (c.liste) expect(cat.liste(c.liste), `${element.id} → ${c.liste}`).toBeTruthy()
      }
      for (const niveau of Object.keys(element.aptitudes)) expect(Number(niveau)).toBeLessThanOrEqual(20)
    }
  })

  it('donne les bonnes améliorations de caractéristique au guerrier et au roublard', () => {
    expect(cat.classe('guerrier').ameliorations).toEqual([4, 6, 8, 12, 14, 16, 19])
    expect(cat.classe('roublard').ameliorations).toEqual([4, 8, 10, 12, 16, 19])
    expect(cat.classe('magicien').ameliorations).toEqual([4, 8, 12, 16, 19])
  })
})

describe('creerCatalogue', () => {
  it('ajoute les éléments d’autres livres à ceux du SRD', () => {
    const cat = creerCatalogue([...ELEMENTS_SRD, { type: 'sous-classe', id: 'maitre-armes', classe: 'guerrier', nom: 'Maître de guerre', source: 'PHB', aptitudes: {} }])
    expect(cat.sousClassesDe('guerrier').map((s) => s.id)).toEqual(['champion', 'maitre-armes'])
    expect(cat.sousClasse('guerrier', 'maitre-armes').source).toBe('PHB')
  })

  it('refuse deux éléments du même type avec le même id', () => {
    expect(() => creerCatalogue([...ELEMENTS_SRD, { type: 'don', id: 'lutteur', nom: 'Bis', source: 'X' }])).toThrow(/lutteur/)
  })

  it('refuse un type inconnu', () => {
    expect(() => creerCatalogue([{ type: 'potion', id: 'x', nom: 'X', source: 'X' }])).toThrow(/potion/)
  })

  it('ne trouve rien pour un id inconnu, sans se laisser piéger par les propriétés d’objet', () => {
    const cat = srd()
    expect(cat.classe('toString')).toBeNull()
    expect(cat.don('__proto__')).toBeNull()
    expect(cat.sousClasse('guerrier', 'voleur')).toBeNull()
  })
})

describe('erreurCatalogue : un fichier de règles se vérifie avant d’être importé', () => {
  const sousClasse = (x = {}) => ({ type: 'sous-classe', id: 'maitre', classe: 'guerrier', nom: 'Maître de guerre', source: 'PHB', aptitudes: {}, ...x })

  it('accepte le SRD et des ajouts cohérents', () => {
    expect(erreurCatalogue(ELEMENTS_SRD)).toBeNull()
    expect(erreurCatalogue([...ELEMENTS_SRD, sousClasse({ choix: { 3: [{ liste: 'styles-guerrier', nombre: 1 }] } })])).toBeNull()
  })

  it('signale l’élément fautif', () => {
    expect(erreurCatalogue([...ELEMENTS_SRD, sousClasse({ classe: 'pirate' })])).toMatch(/maitre.*pirate/)
    expect(erreurCatalogue([...ELEMENTS_SRD, sousClasse({ choix: { 3: [{ liste: 'manoeuvres', nombre: 3 }] } })])).toMatch(/manoeuvres/)
    expect(erreurCatalogue([...ELEMENTS_SRD, sousClasse({ id: 'Maître!' })])).toMatch(/id/)
    expect(erreurCatalogue([...ELEMENTS_SRD, sousClasse({ nom: '' })])).toMatch(/nom/)
    expect(erreurCatalogue([...ELEMENTS_SRD, sousClasse(), sousClasse()])).toMatch(/double/)
    expect(erreurCatalogue([...ELEMENTS_SRD, { type: 'don', id: 'x', nom: 'X', source: 'PHB', amelioration: { parmi: ['chance'], valeur: 1 } }])).toMatch(/x/)
    expect(erreurCatalogue([...ELEMENTS_SRD, { type: 'don', id: 'y', nom: 'Y', source: 'PHB', choix: [{ liste: 'nulle-part', nombre: 1 }] }])).toMatch(/nulle-part/)
    expect(erreurCatalogue('pas une liste')).toBeTruthy()
  })
})
