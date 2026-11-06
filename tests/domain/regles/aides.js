import { ficheVierge } from '../../../src/domain/personnage.js'
import { creerCatalogue } from '../../../src/domain/regles/catalogue.js'
import { rattacher } from '../../../src/domain/regles/montee.js'
import { ELEMENTS_SRD } from '../../../src/domain/regles/srd.js'

/** Deux dons qui n'existent pas dans le SRD, pour tester les dons à demi-caractéristique et ceux qui donnent des PV. */
export const DONS_DE_TEST = [
  { type: 'don', id: 'robuste', nom: 'Robuste', source: 'Test', pvParNiveau: 2, resume: '+2 PV par niveau.' },
  { type: 'don', id: 'athlete', nom: 'Athlète', source: 'Test', amelioration: { parmi: ['for', 'dex'], valeur: 1 }, resume: '+1 For ou Dex.' },
]

export const srd = () => creerCatalogue(ELEMENTS_SRD)
export const catalogue = () => creerCatalogue([...ELEMENTS_SRD, ...DONS_DE_TEST])

const CARACS = { for: 16, dex: 12, con: 14, int: 8, sag: 10, cha: 10 }

/** Une fiche au niveau donné, rattachée aux règles pour une classe (et sa sous-classe s'il en faut une). */
export function ficheDe(classe, niveau, { sousClasse = null, caracs = {}, competences = {}, pvMax = 20, cat = catalogue() } = {}) {
  const fiche = {
    ...ficheVierge('Test'), niveau, pvMax, pvActuels: pvMax,
    caracteristiques: { ...CARACS, ...caracs }, competences,
  }
  return rattacher(fiche, { classe, sousClasse }, cat)
}
