import { describe, expect, it } from 'vitest'
import { ficheVierge } from '../../../src/domain/personnage.js'
import { appliquerMontee, choixEnRetard, erreurRattrapage, erreurMontee, rattraperChoix } from '../../../src/domain/regles/montee.js'
import { catalogue, ficheDe } from './aides.js'

const cat = catalogue()
const ids = (liste) => liste.map((x) => x.id)
const resume = (retards) => retards.map(({ cle, classe, manquants }) => ({ cle, classe, manquants }))

describe('les choix d’avant le rattachement', () => {
  it('restent à faire : un occultiste rattaché au niveau 5 doit encore prendre 3 manifestations et son pacte', () => {
    const fiche = ficheDe('occultiste', 5, { sousClasse: 'fielon' })
    expect(resume(choixEnRetard(fiche, cat))).toEqual([
      { cle: 'invocations', classe: 'occultiste', manquants: 3 },
      { cle: 'pactes', classe: 'occultiste', manquants: 1 },
    ])
  })

  it('ne proposent que les options permises au niveau de la classe', () => {
    const [invocations] = choixEnRetard(ficheDe('occultiste', 5, { sousClasse: 'fielon' }), cat)
    expect(ids(invocations.options)).toContain('armure-ombres')
    expect(ids(invocations.options)).not.toContain('pas-aerien')
  })

  it('valent pour le style de combat du guerrier', () => {
    expect(resume(choixEnRetard(ficheDe('guerrier', 3, { sousClasse: 'champion' }), cat)))
      .toEqual([{ cle: 'styles-guerrier', classe: 'guerrier', manquants: 1 }])
  })

  it('n’existent pas pour une fiche libre ni pour les choix faits en montant de niveau sur le site', () => {
    expect(choixEnRetard({ ...ficheVierge('X'), regles: null }, cat)).toEqual([])
    const fiche = ficheDe('occultiste', 1, { sousClasse: 'fielon' })
    const demande = { classe: 'occultiste', choix: { invocations: ['armure-ombres', 'vision-diable'] } }
    expect(erreurMontee(fiche, demande, cat)).toBeNull()
    expect(choixEnRetard(appliquerMontee(fiche, demande, cat), cat)).toEqual([])
  })
})

describe('rattraper un choix', () => {
  const occultiste = () => ficheDe('occultiste', 5, { sousClasse: 'fielon' })

  it('ajoute les options prises, même en plusieurs fois', () => {
    let fiche = rattraperChoix(occultiste(), 'invocations', ['armure-ombres'], cat)
    expect(fiche.regles.choix.invocations).toEqual(['armure-ombres'])
    expect(choixEnRetard(fiche, cat)[0].manquants).toBe(2)
    fiche = rattraperChoix(fiche, 'invocations', ['vision-diable', 'langage-betes'], cat)
    expect(resume(choixEnRetard(fiche, cat))).toEqual([{ cle: 'pactes', classe: 'occultiste', manquants: 1 }])
  })

  it('ouvre les options qui dépendent d’un autre choix', () => {
    const avant = choixEnRetard(occultiste(), cat)[0]
    expect(ids(avant.options)).not.toContain('livre-secrets')
    const fiche = rattraperChoix(occultiste(), 'pactes', ['pacte-tome'], cat)
    expect(ids(choixEnRetard(fiche, cat)[0].options)).toContain('livre-secrets')
  })

  it('refuse trop d’options, une option interdite, un doublon, une liste sans retard et une fiche libre', () => {
    const fiche = occultiste()
    expect(erreurRattrapage(fiche, 'invocations', ['armure-ombres', 'vision-diable', 'langage-betes', 'influence-ensorceleuse'], cat)).toMatch(/3 au plus/)
    expect(erreurRattrapage(fiche, 'invocations', ['pas-aerien'], cat)).toMatch(/non disponible/)
    expect(erreurRattrapage(fiche, 'invocations', ['armure-ombres', 'armure-ombres'], cat)).toMatch(/deux fois/)
    expect(erreurRattrapage(fiche, 'invocations', [], cat)).toMatch(/fais ton choix/)
    expect(erreurRattrapage(fiche, 'styles-guerrier', ['defense'], cat)).toMatch(/Rien à rattraper/)
    expect(erreurRattrapage({ ...ficheVierge('X'), regles: null }, 'invocations', ['armure-ombres'], cat)).toMatch(/ne suit pas/)
    expect(() => rattraperChoix(fiche, 'invocations', ['pas-aerien'], cat)).toThrow(/non disponible/)
  })
})
