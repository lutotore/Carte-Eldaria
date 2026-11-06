import { ficheVierge } from '../../../src/domain/personnage.js'
import { creerCatalogue } from '../../../src/domain/regles/catalogue.js'
import { rattacher } from '../../../src/domain/regles/montee.js'
import { ELEMENTS_SRD } from '../../../src/domain/regles/srd.js'

/** Deux dons qui n'existent pas dans le SRD, pour tester les dons à demi-caractéristique et ceux qui donnent des PV. */
export const DONS_DE_TEST = [
  { type: 'don', id: 'robuste', nom: 'Robuste', source: 'Test', pvParNiveau: 2, resume: '+2 PV par niveau.' },
  { type: 'don', id: 'athlete', nom: 'Athlète', source: 'Test', amelioration: { parmi: ['for', 'dex'], valeur: 1 }, resume: '+1 For ou Dex.' },
  {
    type: 'don', id: 'resistant', nom: 'Résistant', source: 'Test', sauvegarde: true,
    amelioration: { parmi: ['for', 'dex', 'con', 'int', 'sag', 'cha'], valeur: 1 }, resume: '+1 et la sauvegarde.',
  },
  { type: 'don', id: 'ritualiste', nom: 'Ritualiste', source: 'Test', prerequis: { caracsUneDe: { int: 13, sag: 13 } }, resume: 'Rituels.' },
  { type: 'don', id: 'mage-de-guerre', nom: 'Mage de guerre', source: 'Test', prerequis: { note: 'Capacité à lancer au moins un sort' }, resume: 'Concentration.' },
  { type: 'don', id: 'doue', nom: 'Doué', source: 'Test', choix: [{ type: 'competences', nombre: 3 }], resume: '3 compétences.' },
  {
    type: 'don', id: 'adepte', nom: 'Adepte des éléments', source: 'Test', repetable: true,
    choix: [{ liste: 'elements-test', nombre: 1 }], resume: 'Un type de dégâts.',
  },
  { type: 'liste', id: 'elements-test', nom: 'Élément', source: 'Test', options: [{ id: 'feu', nom: 'Feu' }, { id: 'froid', nom: 'Froid' }] },
  {
    type: 'sous-classe', id: 'chevalier-test', classe: 'guerrier', nom: 'Chevalier occulte', source: 'Test', incantation: 'tiers',
    aptitudes: { 3: ['Incantation'] },
  },
  {
    type: 'sous-classe', id: 'savoir-test', classe: 'clerc', nom: 'Domaine du savoir', source: 'Test',
    aptitudes: { 1: ['Bénédictions du savoir'] },
    choix: { 1: [{ type: 'competences', nombre: 2, parmi: ['arcanes', 'histoire', 'nature', 'religion'], expertise: true }] },
  },
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
