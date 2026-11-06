import { describe, expect, it } from 'vitest'
import { creerCatalogue, erreurCatalogue } from '../../../src/domain/regles/catalogue.js'
import { appliquerSorts, erreurSorts, etatDesSorts, nouveauxSorts } from '../../../src/domain/regles/sorts.js'
import { ELEMENTS_SRD } from '../../../src/domain/regles/srd.js'
import { ficheDe } from './aides.js'

const sort = (id, niveau, classes, x = {}) => ({ type: 'sort', id, nom: id, niveau, ecole: 'évocation', classes, source: 'Test', ...x })
const SORTS = [
  sort('lumiere', 0, ['barde', 'clerc', 'magicien']), sort('amis', 0, ['barde', 'magicien'], { ecole: 'enchantement' }),
  sort('moquerie', 0, ['barde'], { ecole: 'enchantement' }), sort('main-du-mage', 0, ['barde', 'magicien'], { ecole: 'invocation' }),
  sort('soin', 1, ['barde', 'clerc', 'druide', 'paladin']), sort('sommeil', 1, ['barde', 'magicien'], { ecole: 'enchantement' }),
  sort('benediction', 1, ['clerc', 'paladin'], { ecole: 'enchantement', concentration: true }), sort('bouclier-foi', 1, ['clerc', 'paladin'], { ecole: 'abjuration' }),
  sort('projectile', 1, ['ensorceleur', 'magicien']), sort('bouclier', 1, ['ensorceleur', 'magicien'], { ecole: 'abjuration' }),
  sort('alarme', 1, ['magicien', 'rodeur'], { ecole: 'abjuration', rituel: true }), sort('charme', 1, ['barde', 'magicien'], { ecole: 'enchantement' }),
  sort('arme-spirituelle', 2, ['clerc']), sort('restauration', 2, ['barde', 'clerc', 'druide']),
  sort('boule-de-feu', 3, ['ensorceleur', 'magicien']), sort('revigorer', 3, ['clerc', 'paladin'], { ecole: 'nécromancie' }),
  sort('maledicte', 1, ['occultiste']), sort('decharge', 0, ['occultiste'], { ecole: 'évocation' }),
  sort('mains-brulantes', 1, ['ensorceleur', 'magicien']), sort('sixieme', 6, ['occultiste', 'magicien']),
  {
    type: 'sorts-accordes', id: 'vie-sorts', classe: 'clerc', sousClasse: 'vie', source: 'Test', mode: 'prepares',
    niveaux: { 1: ['benediction', 'soin'], 3: ['restauration', 'arme-spirituelle'] },
  },
  { type: 'sorts-accordes', id: 'fielon-sorts', classe: 'occultiste', sousClasse: 'fielon', source: 'Test', mode: 'etendus', niveaux: { 1: ['mains-brulantes'] } },
  {
    type: 'sorts-accordes', id: 'terre-sorts', classe: 'druide', sousClasse: 'terre', source: 'Test', mode: 'prepares',
    parChoix: { liste: 'terrains-druide', options: { foret: { 3: ['restauration'] }, desert: { 3: ['boule-de-feu'] } } },
  },
  {
    type: 'sous-classe', id: 'chevalier-test', classe: 'guerrier', nom: 'Chevalier occulte', source: 'Test', incantation: 'tiers', aptitudes: {},
    sorts: {
      mode: 'connus', carac: 'int', liste: 'magicien', ecoles: ['abjuration', 'évocation'], libres: [3, 8, 14, 20],
      tours: [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], connus: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
    },
  },
]
const cat = creerCatalogue([...ELEMENTS_SRD, ...SORTS])
const etat = (fiche, classe) => etatDesSorts(fiche, cat).find((e) => e.classe === classe)
const choisir = (fiche, classe, selection) => {
  const erreur = erreurSorts(fiche, classe, selection, cat)
  if (erreur) throw new Error(erreur)
  return appliquerSorts(fiche, classe, selection)
}

describe('etatDesSorts : limites et options de chaque classe qui lance des sorts', () => {
  it('donne au barde ses tours de magie, ses sorts connus, son DD et son attaque', () => {
    const barde = etat(ficheDe('barde', 3, { sousClasse: 'savoir', caracs: { cha: 16 }, cat }), 'barde')
    expect(barde).toMatchObject({
      nom: 'Barde', mode: 'connus', caracteristique: 'cha', dd: 13, attaque: 5, niveauMax: 2,
      limites: { toursDeMagie: 2, connus: 6, secrets: 0, prepares: null, arcanum: [] },
      choisis: { toursDeMagie: [], connus: [], grimoire: [], prepares: [], arcanum: [] },
    })
    expect(barde.options.toursDeMagie).toEqual(['lumiere', 'amis', 'moquerie', 'main-du-mage'])
    expect(barde.options.sorts).toEqual(['soin', 'sommeil', 'charme', 'restauration'])
  })

  it('compte les sorts préparés du clerc, et ses sorts de domaine toujours préparés', () => {
    const clerc = etat(ficheDe('clerc', 3, { sousClasse: 'vie', caracs: { sag: 16 }, cat }), 'clerc')
    expect(clerc.limites).toMatchObject({ toursDeMagie: 3, prepares: 6, connus: null })
    expect(clerc.accordes).toEqual(['benediction', 'soin', 'restauration', 'arme-spirituelle'])
    expect(clerc.options.sorts).toEqual(['bouclier-foi'])
  })

  it('ne donne rien au paladin de niveau 1, puis la moitié de son niveau', () => {
    expect(etat(ficheDe('paladin', 1, { cat }), 'paladin')).toBeUndefined()
    expect(etat(ficheDe('paladin', 5, { sousClasse: 'devotion', caracs: { cha: 14 }, cat }), 'paladin').limites.prepares).toBe(4)
  })

  it('suit le grimoire du magicien : on ne prépare que ce qui y est inscrit', () => {
    const fiche = choisir(ficheDe('magicien', 1, { caracs: { int: 16 }, cat }), 'magicien', { grimoire: ['projectile', 'sommeil', 'bouclier'] })
    const magicien = etat(fiche, 'magicien')
    expect(magicien.limites).toMatchObject({ prepares: 4, grimoire: 6 })
    expect(magicien.options.prepares).toEqual(['projectile', 'sommeil', 'bouclier'])
    expect(erreurSorts(fiche, 'magicien', { prepares: ['charme'] }, cat)).toMatch(/grimoire/)
  })

  it('ajoute la liste étendue du protecteur, et les arcanums de l’occultiste', () => {
    const occultiste = etat(ficheDe('occultiste', 11, { sousClasse: 'fielon', cat }), 'occultiste')
    expect(occultiste.options.sorts).toContain('mains-brulantes')
    expect(occultiste.limites.arcanum).toEqual([6])
    expect(occultiste.options.arcanum).toEqual({ 6: ['sixieme'] })
    expect(occultiste.niveauMax).toBe(5)
  })

  it('choisit les sorts de cercle selon la terre du druide', () => {
    const base = ficheDe('druide', 3, { sousClasse: 'terre', cat })
    const druide = { ...base, regles: { ...base.regles, choix: { 'terrains-druide': ['desert'] } } }
    expect(etat(druide, 'druide').accordes).toEqual(['boule-de-feu'])
  })

  it('fait lancer des sorts au chevalier occulte, dans la liste du magicien', () => {
    const chevalier = etat(ficheDe('guerrier', 3, { sousClasse: 'chevalier-test', caracs: { int: 14 }, cat }), 'guerrier')
    expect(chevalier).toMatchObject({ nom: 'Guerrier (Chevalier occulte)', limites: { toursDeMagie: 2, connus: 3 }, niveauMax: 1 })
    expect(chevalier.options.sorts).toEqual(['sommeil', 'projectile', 'bouclier', 'alarme', 'charme', 'mains-brulantes'])
  })

  it('décrit chaque sort cité une seule fois', () => {
    const etats = etatDesSorts(ficheDe('clerc', 3, { sousClasse: 'vie', cat }), cat)
    expect(etats[0].sorts.benediction).toEqual({ nom: 'benediction', niveau: 1, ecole: 'enchantement', rituel: false, concentration: true, source: 'Test', page: null })
  })
})

describe('erreurSorts : la sélection respecte les règles', () => {
  const barde = () => ficheDe('barde', 3, { sousClasse: 'savoir', caracs: { cha: 16 }, cat })

  it('accepte une sélection juste, et l’enregistre dans les règles', () => {
    const apres = choisir(barde(), 'barde', { toursDeMagie: ['lumiere', 'amis'], connus: ['soin', 'sommeil', 'restauration'] })
    expect(apres.regles.sorts).toEqual({ barde: { toursDeMagie: ['lumiere', 'amis'], connus: ['soin', 'sommeil', 'restauration'] } })
    expect(etat(apres, 'barde').choisis.connus).toEqual(['soin', 'sommeil', 'restauration'])
  })

  it('refuse trop de sorts, un sort trop haut, d’une autre liste, inconnu, en double ou un sort mineur parmi les sorts', () => {
    expect(erreurSorts(barde(), 'barde', { toursDeMagie: ['lumiere', 'amis', 'moquerie'] }, cat)).toMatch(/2/)
    expect(erreurSorts(barde(), 'barde', { connus: ['boule-de-feu'] }, cat)).toMatch(/boule-de-feu/)
    expect(erreurSorts(barde(), 'barde', { connus: ['benediction'] }, cat)).toMatch(/benediction/)
    expect(erreurSorts(barde(), 'barde', { connus: ['nulle-part'] }, cat)).toMatch(/inconnu/)
    expect(erreurSorts(barde(), 'barde', { connus: ['soin', 'soin'] }, cat)).toMatch(/deux fois/)
    expect(erreurSorts(barde(), 'barde', { connus: ['lumiere'] }, cat)).toMatch(/lumiere/)
    expect(erreurSorts(barde(), 'barde', { prepares: ['soin'] }, cat)).toMatch(/prepares/)
    expect(erreurSorts(barde(), 'magicien', { connus: [] }, cat)).toMatch(/ne lance pas/)
    expect(erreurSorts(barde(), 'barde', null, cat)).toBeTruthy()
  })

  it('laisse le barde prendre des secrets magiques dans n’importe quelle liste, sans dépasser leur nombre', () => {
    // Niveau 10 : 2 secrets ; Collège du savoir : 2 de plus au niveau 6, et autant de sorts connus en plus.
    const dix = ficheDe('barde', 10, { sousClasse: 'savoir', caracs: { cha: 16 }, cat })
    expect(etat(dix, 'barde').limites).toMatchObject({ connus: 16, secrets: 4 })
    expect(erreurSorts(dix, 'barde', { connus: ['boule-de-feu', 'benediction', 'bouclier', 'projectile'] }, cat)).toBeNull()
    expect(erreurSorts(dix, 'barde', { connus: ['boule-de-feu', 'benediction', 'bouclier', 'projectile', 'alarme'] }, cat)).toMatch(/secrets/i)
  })

  it('limite les écoles du chevalier occulte, sauf aux niveaux libres', () => {
    const chevalier = ficheDe('guerrier', 3, { sousClasse: 'chevalier-test', caracs: { int: 14 }, cat })
    expect(erreurSorts(chevalier, 'guerrier', { connus: ['projectile', 'bouclier', 'sommeil'] }, cat)).toBeNull()
    expect(erreurSorts(chevalier, 'guerrier', { connus: ['projectile', 'sommeil', 'charme'] }, cat)).toMatch(/école/)
  })

  it('ne compte pas les sorts de domaine dans les sorts préparés, et ne les accepte pas en double', () => {
    const clerc = ficheDe('clerc', 3, { sousClasse: 'vie', caracs: { sag: 10 }, cat })
    expect(erreurSorts(clerc, 'clerc', { prepares: ['bouclier-foi'] }, cat)).toBeNull()
    expect(erreurSorts(clerc, 'clerc', { prepares: ['benediction'] }, cat)).toMatch(/benediction/)
    expect(erreurSorts(clerc, 'clerc', { prepares: ['bouclier-foi', 'revigorer', 'soin', 'arme-spirituelle'] }, cat)).toMatch(/3/)
  })

  it('n’accepte qu’un arcanum par niveau débloqué', () => {
    const occultiste = ficheDe('occultiste', 11, { sousClasse: 'fielon', cat })
    expect(erreurSorts(occultiste, 'occultiste', { arcanum: ['sixieme'] }, cat)).toBeNull()
    expect(erreurSorts(occultiste, 'occultiste', { arcanum: ['maledicte'] }, cat)).toMatch(/arcanum/i)
  })
})

describe('nouveauxSorts : ce qu’annonce la montée de niveau', () => {
  it('compte ce que le niveau suivant apporte', () => {
    expect(nouveauxSorts(cat.classe('barde'), null, 3)).toEqual(['+1 tour de magie', '+1 sort connu'])
    expect(nouveauxSorts(cat.classe('barde'), null, 8)).toEqual(['+1 sort connu', 'sorts jusqu’au niveau 5'])
    expect(nouveauxSorts(cat.classe('magicien'), null, 0)).toEqual(['+3 tours de magie', '6 sorts dans ton grimoire', 'sorts jusqu’au niveau 1'])
    expect(nouveauxSorts(cat.classe('magicien'), null, 1)).toEqual(['+2 sorts dans ton grimoire'])
    expect(nouveauxSorts(cat.classe('occultiste'), null, 10)).toEqual(['+1 sort connu', 'un arcanum mystique de niveau 6'])
    expect(nouveauxSorts(cat.classe('barde'), null, 9)).toEqual(['+1 tour de magie', '+2 sorts connus, dont 2 secrets magiques pris dans n’importe quelle liste'])
    expect(nouveauxSorts(cat.classe('guerrier'), cat.sousClasse('guerrier', 'chevalier-test'), 2)).toEqual(['+2 tours de magie', '+3 sorts connus', 'sorts jusqu’au niveau 1'])
    expect(nouveauxSorts(cat.classe('guerrier'), null, 5)).toEqual([])
    expect(nouveauxSorts(cat.classe('clerc'), null, 2)).toEqual(['sorts jusqu’au niveau 2'])
  })
})

describe('sorts enrichis par un livre', () => {
  it('ajoute des classes à un sort existant (sorts supplémentaires de Tasha)', () => {
    const ajout = { type: 'sort', id: 'sommeil', ajout: true, classes: ['ensorceleur'], source: 'Tasha' }
    const avecAjout = creerCatalogue([...ELEMENTS_SRD, ...SORTS, ajout])
    expect(avecAjout.sort('sommeil').classes).toEqual(['barde', 'magicien', 'ensorceleur'])
    expect(erreurCatalogue([...ELEMENTS_SRD, ...SORTS, { ...ajout, id: 'nulle-part' }])).toMatch(/nulle-part/)
  })

  it('étend la liste selon un choix de sous-classe (catégorie du génie)', () => {
    const genie = [
      { type: 'liste', id: 'genies', nom: 'Génie', source: 'Test', options: [{ id: 'efrit', nom: 'Éfrit' }, { id: 'marid', nom: 'Marid' }] },
      { type: 'sous-classe', id: 'genie', classe: 'occultiste', nom: 'Le Génie', source: 'Test', aptitudes: {}, choix: { 1: [{ liste: 'genies', nombre: 1 }] } },
      {
        type: 'sorts-accordes', id: 'genie-sorts', classe: 'occultiste', sousClasse: 'genie', source: 'Test', mode: 'etendus',
        niveaux: { 1: ['projectile'] }, parChoix: { liste: 'genies', options: { efrit: { 1: ['mains-brulantes'] }, marid: { 3: ['boule-de-feu'] } } },
      },
    ]
    const c = creerCatalogue([...ELEMENTS_SRD, ...SORTS, ...genie])
    const base = ficheDe('occultiste', 1, { sousClasse: 'genie', cat: c })
    const fiche = { ...base, regles: { ...base.regles, choix: { genies: ['efrit'] } } }
    const occultiste = etatDesSorts(fiche, c)[0]
    expect(occultiste.options.sorts).toEqual(expect.arrayContaining(['projectile', 'mains-brulantes', 'maledicte']))
    expect(occultiste.options.sorts).not.toContain('boule-de-feu')
  })
})

describe('catalogue des sorts', () => {
  it('vérifie que les sorts accordés existent', () => {
    expect(erreurCatalogue([...ELEMENTS_SRD, ...SORTS])).toBeNull()
    const faux = { type: 'sorts-accordes', id: 'x', classe: 'clerc', sousClasse: 'vie', source: 'Test', mode: 'prepares', niveaux: { 1: ['nulle-part'] } }
    expect(erreurCatalogue([...ELEMENTS_SRD, ...SORTS, faux])).toMatch(/nulle-part/)
  })
})
