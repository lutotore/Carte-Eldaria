import { describe, expect, it } from 'vitest'
import { creerCatalogue, erreurCatalogue } from '../../../src/domain/regles/catalogue.js'
import { emplacements } from '../../../src/domain/regles/emplacements.js'
import { annulerDerniereMontee, appliquerMontee, erreurMontee, optionsDeMontee } from '../../../src/domain/regles/montee.js'
import { ELEMENTS_SRD } from '../../../src/domain/regles/srd.js'
import { ficheDe } from './aides.js'

/** Ce que Xanathar et Tasha ajoutent, en miniature. */
const LIVRES = [
  { type: 'liste', id: 'styles-guerrier', ajout: true, source: 'Tasha', nom: 'Style de combat', options: [{ id: 'interception', nom: 'Interception' }] },
  { type: 'liste', id: 'infusions', nom: 'Infusion', source: 'Tasha', options: [{ id: 'replique', nom: 'Réplique d’objet magique', repetable: true }, { id: 'bouclier', nom: 'Bouclier répulsif' }] },
  {
    type: 'classe', id: 'artificier', nom: 'Artificier', source: 'Tasha', de: 8, sauvegardes: ['con', 'int'], incantation: 'artificier',
    multiclasse: { prerequis: [{ int: 13 }], maitrises: 'armures légères' }, niveauSousClasse: 3, ameliorations: [4, 8, 12, 16, 19],
    aptitudes: { 1: ['Bricolage magique', 'Incantation'], 2: ['Infusion d’objets'] },
    choix: { 2: [{ liste: 'infusions', nombre: 1 }], 3: [{ liste: 'infusions', nombre: 1 }] },
  },
  {
    type: 'option-classe', id: 'ennemi-favori', classe: 'rodeur', niveau: 1, nom: 'Ennemi favori', source: 'Tasha', page: 57,
    resume: 'Remplace Ennemi juré.', remplace: { aptitudes: ['Ennemi juré'], listes: ['ennemis-jures'] },
  },
  {
    type: 'option-classe', id: 'connaissance-primitive', classe: 'barbare', niveau: 3, nom: 'Connaissance primitive', source: 'Tasha', page: 24,
    resume: 'Une compétence de barbare en plus.', choix: [{ type: 'competences', nombre: 1, parmi: ['athletisme', 'survie'] }],
  },
]
const cat = creerCatalogue([...ELEMENTS_SRD, ...LIVRES])
const monter = (fiche, demande) => {
  const erreur = erreurMontee(fiche, demande, cat)
  if (erreur) throw new Error(erreur)
  return appliquerMontee(fiche, demande, cat)
}
const ids = (liste) => liste.map((x) => x.id)

describe('listes enrichies par un livre', () => {
  it('ajoutent leurs options à la liste d’origine, quel que soit l’ordre des éléments', () => {
    expect(ids(cat.liste('styles-guerrier').options)).toEqual(['archerie', 'defense', 'duel', 'arme-a-deux-mains', 'protection', 'deux-armes', 'interception'])
    expect(ids(creerCatalogue([LIVRES[0], ...ELEMENTS_SRD]).liste('styles-guerrier').options)).toContain('interception')
  })

  it('refusent d’enrichir une liste inconnue ou de doubler une option', () => {
    expect(erreurCatalogue([...ELEMENTS_SRD, { ...LIVRES[0], id: 'nulle-part' }])).toMatch(/nulle-part/)
    expect(erreurCatalogue([...ELEMENTS_SRD, { ...LIVRES[0], options: [{ id: 'duel', nom: 'Duel' }] }])).toMatch(/duel/)
    expect(erreurCatalogue([...ELEMENTS_SRD, ...LIVRES])).toBeNull()
  })

  it('reproposent une option répétable déjà prise', () => {
    const fiche = monter(ficheDe('artificier', 1, { caracs: { int: 14 }, cat }), { classe: 'artificier', choix: { infusions: ['replique'] } })
    expect(ids(optionsDeMontee(fiche, cat).choix[0].options)).toEqual(['replique', 'bouclier'])
  })
})

describe('artificier', () => {
  it('compte la moitié de ses niveaux arrondie au supérieur, dès le niveau 1 et en multiclasse', () => {
    const regles = (...classes) => ({ classes: classes.map(([classe, niveau]) => ({ classe, niveau, sousClasse: null })) })
    expect(emplacements(regles(['artificier', 1]), cat).sorts).toEqual([2])
    expect(emplacements(regles(['artificier', 3]), cat).sorts).toEqual([3])
    expect(emplacements(regles(['artificier', 3], ['magicien', 2]), cat).sorts).toEqual([4, 3])
    expect(emplacements(regles(['artificier', 1], ['paladin', 2]), cat).sorts).toEqual([3])
  })
})

describe('aptitudes optionnelles de classe', () => {
  const guerrier = () => ficheDe('guerrier', 3, { sousClasse: 'champion', caracs: { dex: 14, sag: 14 }, cat })

  it('sont proposées au niveau prévu, avec ce qu’elles remplacent', () => {
    expect(optionsDeMontee(guerrier(), cat, 'rodeur').optionnelles).toEqual([{
      id: 'ennemi-favori', nom: 'Ennemi favori', source: 'Tasha', page: 57, resume: 'Remplace Ennemi juré.',
      remplace: { aptitudes: ['Ennemi juré'], listes: ['ennemis-jures'] }, choix: [],
    }])
    expect(optionsDeMontee(ficheDe('barbare', 1, { cat }), cat).optionnelles).toEqual([])
  })

  it('remplacent les choix d’origine quand on les prend', () => {
    const fiche = guerrier()
    // En entrant dans la classe, le rôdeur multiclassé choisit aussi une compétence.
    const sansOption = { classe: 'rodeur', choix: { competences: ['survie'], 'ennemis-jures': ['dragons'], 'terrains-favoris': ['foret'] } }
    expect(erreurMontee(fiche, { ...sansOption, optionnelles: ['ennemi-favori'] }, cat)).toMatch(/inattendu/)
    const apres = monter(fiche, { classe: 'rodeur', optionnelles: ['ennemi-favori'], choix: { competences: ['survie'], 'terrains-favoris': ['foret'] } })
    expect(apres.regles.choix['options-classe']).toEqual(['ennemi-favori'])
    expect(erreurMontee(fiche, sansOption, cat)).toBeNull()
  })

  it('continuent de remplacer aux niveaux suivants', () => {
    let fiche = monter(ficheDe('rodeur', 1, { cat }), { classe: 'rodeur', choix: { 'styles-rodeur': ['duel'] } })
    fiche = { ...fiche, regles: { ...fiche.regles, choix: { ...fiche.regles.choix, 'options-classe': ['ennemi-favori'] } } }
    for (let n = 3; n <= 5; n += 1) {
      const options = optionsDeMontee(fiche, cat)
      fiche = monter(fiche, {
        classe: 'rodeur', ...(options.sousClasse ? { sousClasse: 'chasseur', choix: { 'proie-chasseur': ['tueur-colosses'] } } : {}),
        ...(options.amelioration ? { amelioration: { caracs: { dex: 2 } } } : {}),
      })
    }
    const sixieme = optionsDeMontee(fiche, cat)
    expect(sixieme.choix.map((c) => c.cle)).toEqual(['terrains-favoris'])
    expect(sixieme.aptitudes).not.toContain('Ennemi juré amélioré')
  })

  it('demandent leurs propres choix, et s’annulent avec la montée', () => {
    const barbare = ficheDe('barbare', 2, { cat })
    const demande = { classe: 'barbare', sousClasse: 'berserker', optionnelles: ['connaissance-primitive'] }
    expect(erreurMontee(barbare, demande, cat)).toMatch(/Compétence/)
    const apres = monter(barbare, { ...demande, choix: { competences: ['survie'] } })
    expect(apres.competences).toEqual({ survie: 1 })
    expect(optionsDeMontee(barbare, cat).aptitudes).toEqual(['Voie primitive'])
    expect(annulerDerniereMontee(apres, cat)).toEqual(barbare)
    expect(erreurMontee(barbare, { ...demande, optionnelles: ['ennemi-favori'] }, cat)).toMatch(/optionnelle/)
  })
})
