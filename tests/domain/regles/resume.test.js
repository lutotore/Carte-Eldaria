import { describe, expect, it } from 'vitest'
import { creerCatalogue } from '../../../src/domain/regles/catalogue.js'
import { resumeDesRegles } from '../../../src/domain/regles/resume.js'
import { ELEMENTS_SRD } from '../../../src/domain/regles/srd.js'
import { DONS_DE_TEST, ficheDe } from './aides.js'

const ENNEMI_DESIGNE = {
  type: 'option-classe', id: 'ennemi-designe', classe: 'rodeur', niveau: 1, nom: 'Ennemi désigné', source: 'Tasha', page: 70,
  remplace: { aptitudes: ['Ennemi juré'], listes: ['ennemis-jures'] },
}
const cat = creerCatalogue([...ELEMENTS_SRD, ...DONS_DE_TEST, ENNEMI_DESIGNE])
const avecChoix = (fiche, choix) => ({ ...fiche, regles: { ...fiche.regles, choix } })

describe('resumeDesRegles : ce que la fiche affiche d’après les règles', () => {
  it('décrit les classes et leurs aptitudes niveau par niveau, sous-classe comprise', () => {
    const resume = resumeDesRegles(ficheDe('guerrier', 3, { sousClasse: 'champion', cat }), cat)
    expect(resume.classes).toEqual([{
      id: 'guerrier', nom: 'Guerrier', niveau: 3, de: 10, sousClasse: { id: 'champion', nom: 'Champion', source: 'SRD 5.1', page: null },
      niveaux: [
        { niveau: 1, aptitudes: ['Style de combat', 'Second souffle'] },
        { niveau: 2, aptitudes: ['Fougue (1 utilisation)'] },
        { niveau: 3, aptitudes: ['Archétype martial', 'Critique amélioré'] },
      ],
    }])
    expect(resume.emplacements).toEqual({ sorts: [], pacte: null })
  })

  it('donne les choix faits avec leur nom, et les dons avec leur résumé', () => {
    const fiche = avecChoix(ficheDe('roublard', 6, { sousClasse: 'voleur', cat }), {
      expertise: ['discretion', 'outils-voleur'], 'styles-guerrier': ['defense'], dons: ['robuste'], competences: ['arcanes'],
    })
    const resume = resumeDesRegles(fiche, cat)
    expect(resume.choix).toEqual([
      { libelle: 'Expertise', valeurs: ['Discrétion', 'Outils de voleur'] },
      { libelle: 'Style de combat', valeurs: ['Défense'] },
      { libelle: 'Compétences gagnées', valeurs: ['Arcanes'] },
    ])
    expect(resume.dons).toEqual([{ id: 'robuste', nom: 'Robuste', source: 'Test', page: null, resume: '+2 PV par niveau.' }])
  })

  it('remplace les aptitudes par les aptitudes optionnelles prises', () => {
    const fiche = avecChoix(ficheDe('rodeur', 6, { sousClasse: 'chasseur', cat }), { 'options-classe': ['ennemi-designe'] })
    const { niveaux } = resumeDesRegles(fiche, cat).classes[0]
    expect(niveaux[0].aptitudes).toEqual(['Explorateur-né', 'Ennemi désigné'])
    expect(niveaux.find((n) => n.niveau === 6).aptitudes).toEqual(['Explorateur-né amélioré'])
    expect(resumeDesRegles(fiche, cat).choix).toEqual([{ libelle: 'Aptitudes optionnelles', valeurs: ['Ennemi désigné'] }])
  })

  it('compte les emplacements de toutes les classes', () => {
    const fiche = ficheDe('clerc', 3, { sousClasse: 'vie', cat })
    const multi = { ...fiche, regles: { ...fiche.regles, classes: [...fiche.regles.classes, { classe: 'occultiste', niveau: 2, sousClasse: 'fielon' }] } }
    expect(resumeDesRegles(multi, cat).emplacements).toEqual({ sorts: [4, 2], pacte: { nombre: 2, niveau: 1 } })
    expect(resumeDesRegles(multi, cat).classes.map((c) => c.nom)).toEqual(['Clerc', 'Occultiste'])
  })

  it('tient bon quand un livre a été retiré du serveur', () => {
    const fiche = avecChoix(ficheDe('guerrier', 3, { sousClasse: 'champion', cat }), { dons: ['disparu'], manoeuvres: ['parade'] })
    const sansLivre = { ...fiche, regles: { ...fiche.regles, classes: [...fiche.regles.classes, { classe: 'artificier', niveau: 1, sousClasse: null }] } }
    const resume = resumeDesRegles(sansLivre, cat)
    expect(resume.classes[1]).toMatchObject({ id: 'artificier', nom: 'artificier', niveaux: [] })
    expect(resume.dons).toEqual([{ id: 'disparu', nom: 'disparu', source: null, page: null, resume: '' }])
    expect(resume.choix).toEqual([{ libelle: 'manoeuvres', valeurs: ['parade'] }])
  })
})
