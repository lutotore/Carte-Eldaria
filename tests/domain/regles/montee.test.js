import { describe, expect, it } from 'vitest'
import { ficheVierge } from '../../../src/domain/personnage.js'
import {
  annulerDerniereMontee, classesPossibles, appliquerMontee, erreurMontee, erreurRattachement, optionsDeMontee, rattacher,
} from '../../../src/domain/regles/montee.js'
import { catalogue, ficheDe } from './aides.js'

const cat = catalogue()
const monter = (fiche, demande) => {
  const erreur = erreurMontee(fiche, demande, cat)
  if (erreur) throw new Error(erreur)
  return appliquerMontee(fiche, demande, cat)
}
const ids = (liste) => liste.map((x) => x.id)

describe('rattacher une fiche existante aux règles', () => {
  it('reprend son niveau, sa classe et sa sous-classe, sans toucher à ses PV', () => {
    const fiche = ficheDe('guerrier', 3, { sousClasse: 'champion', pvMax: 31 })
    expect(fiche.regles).toEqual({
      classes: [{ classe: 'guerrier', niveau: 3, sousClasse: 'champion' }], pvDes: [10, 6, 6], choix: {}, montees: [],
    })
    expect(fiche).toMatchObject({ classe: 'Guerrier 3 (Champion)', desDeVie: '3d10', pvMax: 31 })
  })

  it('n’exige pas de sous-classe avant le niveau où on la choisit', () => {
    expect(ficheDe('guerrier', 2).classe).toBe('Guerrier 2')
    expect(erreurRattachement({ ...ficheVierge('X'), niveau: 2 }, { classe: 'guerrier', sousClasse: 'champion' }, cat)).toMatch(/niveau 3/)
  })

  it('refuse une classe inconnue, une sous-classe manquante ou d’une autre classe, et une fiche déjà rattachée', () => {
    const vierge = { ...ficheVierge('X'), niveau: 3 }
    expect(erreurRattachement(vierge, { classe: 'pirate' }, cat)).toMatch(/Classe inconnue/)
    expect(erreurRattachement(vierge, { classe: 'guerrier' }, cat)).toMatch(/sous-classe/)
    expect(erreurRattachement(vierge, { classe: 'guerrier', sousClasse: 'voleur' }, cat)).toMatch(/sous-classe/)
    expect(erreurRattachement(ficheDe('guerrier', 1), { classe: 'guerrier' }, cat)).toMatch(/déjà/)
  })

  it('demande la sous-classe dès le niveau 1 pour le clerc', () => {
    expect(erreurRattachement({ ...ficheVierge('X'), niveau: 1 }, { classe: 'clerc' }, cat)).toMatch(/sous-classe/)
    expect(ficheDe('clerc', 1, { sousClasse: 'vie' }).classe).toBe('Clerc 1 (Domaine de la vie)')
  })
})

describe('rattacher avec les dons déjà pris', () => {
  it('les garde dans les règles, sans toucher aux PV', () => {
    const fiche = rattacher({ ...ficheVierge('Ivan'), niveau: 4, pvMax: 40 }, { classe: 'guerrier', sousClasse: 'champion', dons: ['robuste'] }, cat)
    expect(fiche.regles.choix).toEqual({ dons: ['robuste'] })
    expect(fiche.pvMax).toBe(40)
  })

  it('refuse un don inconnu, ou pris deux fois s’il ne se répète pas', () => {
    const fiche = { ...ficheVierge('Ivan'), niveau: 4 }
    expect(erreurRattachement(fiche, { classe: 'guerrier', sousClasse: 'champion', dons: ['inconnu'] }, cat)).toMatch(/Don inconnu/)
    expect(erreurRattachement(fiche, { classe: 'guerrier', sousClasse: 'champion', dons: ['robuste', 'robuste'] }, cat)).toMatch(/deux fois/)
    expect(erreurRattachement(fiche, { classe: 'guerrier', sousClasse: 'champion', dons: 'robuste' }, cat)).toMatch(/Dons/)
    expect(erreurRattachement(fiche, { classe: 'guerrier', sousClasse: 'champion', dons: ['adepte', 'adepte'] }, cat)).toBeNull()
  })
})

describe('optionsDeMontee', () => {
  it('ne propose rien à une fiche qui n’est pas rattachée, ni au niveau 20', () => {
    expect(optionsDeMontee(ficheVierge('X'), cat)).toMatchObject({ possible: false, raison: expect.stringMatching(/classe/) })
    expect(optionsDeMontee(ficheDe('guerrier', 20, { sousClasse: 'champion' }), cat)).toMatchObject({ possible: false, raison: expect.stringMatching(/20/) })
  })

  it('annonce le niveau atteint, les PV gagnés (moyenne du dé + Con) et les aptitudes', () => {
    const options = optionsDeMontee(ficheDe('guerrier', 4, { sousClasse: 'champion' }), cat)
    expect(options).toMatchObject({
      possible: true, classe: { id: 'guerrier', nom: 'Guerrier' }, niveauClasse: 5, niveauTotal: 5,
      pv: { de: 10, moyenne: 6, gain: 8 }, aptitudes: ['Attaque supplémentaire'], sousClasse: null, amelioration: null, choix: [],
    })
  })

  it('propose les sous-classes au bon niveau, avec ce que chacune apporte', () => {
    const options = optionsDeMontee(ficheDe('guerrier', 2), cat)
    expect(options.sousClasse[0]).toEqual({ id: 'champion', nom: 'Champion', source: 'SRD 5.1', page: null, aptitudes: ['Critique amélioré'], choix: [], sorts: [] })
    expect(ids(options.sousClasse)).toEqual(['champion', 'chevalier-test'])
    expect(options.aptitudes).toEqual(['Archétype martial'])
  })

  it('ajoute les aptitudes et les choix de la sous-classe déjà prise', () => {
    const options = optionsDeMontee(ficheDe('rodeur', 2, { sousClasse: null }), cat)
    expect(options.sousClasse[0]).toMatchObject({ id: 'chasseur', choix: [{ cle: 'proie-chasseur', nombre: 1 }] })
    const ensuite = optionsDeMontee(ficheDe('rodeur', 6, { sousClasse: 'chasseur' }), cat)
    expect(ensuite.aptitudes).toEqual(['Tactiques défensives'])
    expect(ensuite.choix.map((c) => c.cle)).toEqual(['tactiques-defensives'])
  })

  it('propose l’amélioration de caractéristiques ou un don aux niveaux de la classe, avec les prérequis', () => {
    const options = optionsDeMontee(ficheDe('guerrier', 3, { sousClasse: 'champion', caracs: { for: 12 } }), cat)
    expect(options.amelioration.caracs).toMatchObject({ for: 12, con: 14 })
    const lutteur = options.amelioration.dons.find((d) => d.id === 'lutteur')
    expect(lutteur).toMatchObject({ disponible: false, raison: 'Force 13 requise.' })
    expect(options.amelioration.dons.find((d) => d.id === 'athlete')).toMatchObject({ disponible: true, amelioration: { parmi: ['for', 'dex'], valeur: 1 } })
  })

  it('filtre les manifestations occultes par niveau et par pacte', () => {
    const fiche = monter(ficheDe('occultiste', 2, { sousClasse: 'fielon' }), { classe: 'occultiste', choix: { pactes: ['pacte-lame'] } })
    const options = optionsDeMontee(monter(fiche, { classe: 'occultiste', amelioration: { caracs: { cha: 2 } } }), cat)
    const offertes = ids(options.choix.find((c) => c.cle === 'invocations').options)
    expect(offertes).toEqual(expect.arrayContaining(['brume-mentale', 'lame-assoiffee']))
    expect(offertes).not.toContain('pas-aerien')
    expect(offertes).not.toContain('livre-secrets')
  })

  it('propose l’expertise parmi les compétences maîtrisées, et les outils de voleur au roublard', () => {
    const fiche = ficheDe('roublard', 5, { sousClasse: 'voleur', competences: { discretion: 2, perception: 1, athletisme: 1 } })
    const expertise = optionsDeMontee(fiche, cat).choix[0]
    expect(expertise).toMatchObject({ cle: 'expertise', type: 'expertise', nombre: 2 })
    expect(ids(expertise.options)).toEqual(['athletisme', 'perception', 'outils-voleur'])
  })

  it('signale ce que le site ne gère pas encore pour les lanceurs de sorts', () => {
    expect(optionsDeMontee(ficheDe('magicien', 1), cat).aVenir).toEqual([expect.stringMatching(/sorts/i)])
    expect(optionsDeMontee(ficheDe('guerrier', 1), cat).aVenir).toEqual([])
  })
})

describe('appliquerMontee', () => {
  it('monte la classe d’un niveau et ajoute la moyenne du dé + Con aux PV', () => {
    const avant = ficheDe('guerrier', 4, { sousClasse: 'champion', pvMax: 44 })
    const apres = monter({ ...avant, pvActuels: 30 }, { classe: 'guerrier' })
    expect(apres).toMatchObject({ niveau: 5, classe: 'Guerrier 5 (Champion)', desDeVie: '5d10', pvMax: 52, pvActuels: 38 })
    expect(apres.regles.classes).toEqual([{ classe: 'guerrier', niveau: 5, sousClasse: 'champion' }])
    expect(apres.regles.pvDes).toEqual([10, 6, 6, 6, 6])
    expect(apres.regles.montees).toEqual([{
      classe: 'guerrier', niveau: 5, pv: 8, sousClasse: null, caracs: {}, don: null, sauvegarde: null, choix: {}, competences: {},
    }])
  })

  it('compte au moins 1 PV par niveau, même avec une très mauvaise Constitution', () => {
    expect(monter(ficheDe('magicien', 1, { caracs: { con: 3 }, pvMax: 2 }), { classe: 'magicien', sousClasse: 'evocation' }).pvMax).toBe(3)
  })

  it('ajoute +2 à une caractéristique, ou +1 à deux, sans dépasser 20', () => {
    const fiche = ficheDe('guerrier', 3, { sousClasse: 'champion', caracs: { for: 19 } })
    expect(monter(fiche, { classe: 'guerrier', amelioration: { caracs: { for: 1, dex: 1 } } }).caracteristiques).toMatchObject({ for: 20, dex: 13 })
    expect(erreurMontee(fiche, { classe: 'guerrier', amelioration: { caracs: { for: 2 } } }, cat)).toMatch(/20/)
    expect(erreurMontee(fiche, { classe: 'guerrier', amelioration: { caracs: { dex: 1 } } }, cat)).toMatch(/2 points/)
    expect(erreurMontee(fiche, { classe: 'guerrier', amelioration: { caracs: { chance: 2 } } }, cat)).toMatch(/inconnue/)
    expect(erreurMontee(fiche, { classe: 'guerrier' }, cat)).toMatch(/amélioration/)
  })

  it('rend rétroactif un gain de Constitution', () => {
    const fiche = ficheDe('guerrier', 3, { sousClasse: 'champion', caracs: { con: 15 }, pvMax: 28 })
    // Niveau 4 : 6 + 3, et +1 pour chacun des 3 niveaux déjà acquis.
    expect(monter(fiche, { classe: 'guerrier', amelioration: { caracs: { con: 1, for: 1 } } }).pvMax).toBe(28 + 9 + 3)
  })

  it('refuse une amélioration hors des niveaux prévus', () => {
    expect(erreurMontee(ficheDe('guerrier', 4, { sousClasse: 'champion' }), { classe: 'guerrier', amelioration: { caracs: { for: 2 } } }, cat))
      .toMatch(/Pas d’amélioration/)
  })

  it('prend un don à la place, si ses prérequis sont remplis, et une seule fois', () => {
    const fiche = ficheDe('guerrier', 3, { sousClasse: 'champion' })
    const apres = monter(fiche, { classe: 'guerrier', amelioration: { don: 'lutteur' } })
    expect(apres.regles.choix.dons).toEqual(['lutteur'])
    expect(apres.caracteristiques).toEqual(fiche.caracteristiques)
    expect(erreurMontee(ficheDe('guerrier', 3, { sousClasse: 'champion', caracs: { for: 12 } }), { classe: 'guerrier', amelioration: { don: 'lutteur' } }, cat))
      .toMatch(/Force 13/)
    const cinquieme = monter(apres, { classe: 'guerrier' })
    expect(erreurMontee(cinquieme, { classe: 'guerrier', amelioration: { don: 'lutteur' } }, cat)).toMatch(/déjà/)
    expect(erreurMontee(fiche, { classe: 'guerrier', amelioration: { don: 'inconnu' } }, cat)).toMatch(/Don inconnu/)
  })

  it('demande la caractéristique d’un demi-don', () => {
    const fiche = ficheDe('guerrier', 3, { sousClasse: 'champion' })
    expect(erreurMontee(fiche, { classe: 'guerrier', amelioration: { don: 'athlete' } }, cat)).toMatch(/caractéristique/)
    expect(erreurMontee(fiche, { classe: 'guerrier', amelioration: { don: 'athlete', caracs: { con: 1 } } }, cat)).toMatch(/caractéristique/)
    expect(monter(fiche, { classe: 'guerrier', amelioration: { don: 'athlete', caracs: { dex: 1 } } }).caracteristiques.dex).toBe(13)
  })

  it('applique un don qui donne des PV à tous les niveaux, passés compris', () => {
    const fiche = ficheDe('guerrier', 3, { sousClasse: 'champion', pvMax: 28 })
    expect(monter(fiche, { classe: 'guerrier', amelioration: { don: 'robuste' } }).pvMax).toBe(28 + 8 + 2 * 4)
  })

  it('compte les PV de sous-classe (Résistance draconique)', () => {
    const fiche = ficheDe('ensorceleur', 1, { sousClasse: 'draconique', pvMax: 9 })
    expect(monter(fiche, { classe: 'ensorceleur' }).pvMax).toBe(9 + 4 + 2 + 1)
  })

  it('exige la sous-classe au niveau prévu, et seulement à celui-là', () => {
    const deux = ficheDe('guerrier', 2)
    expect(erreurMontee(deux, { classe: 'guerrier' }, cat)).toMatch(/sous-classe/)
    expect(erreurMontee(deux, { classe: 'guerrier', sousClasse: 'voleur' }, cat)).toMatch(/sous-classe/)
    expect(monter(deux, { classe: 'guerrier', sousClasse: 'champion' }).regles.classes[0].sousClasse).toBe('champion')
    expect(erreurMontee(ficheDe('guerrier', 1), { classe: 'guerrier', sousClasse: 'champion' }, cat)).toMatch(/sous-classe/)
  })

  it('vérifie chaque choix : nombre, options permises, pas de doublon, rien d’inattendu', () => {
    const rodeur = ficheDe('rodeur', 1)
    expect(erreurMontee(rodeur, { classe: 'rodeur' }, cat)).toMatch(/Style de combat/)
    expect(erreurMontee(rodeur, { classe: 'rodeur', choix: { 'styles-rodeur': ['protection'] } }, cat)).toMatch(/option/)
    expect(erreurMontee(rodeur, { classe: 'rodeur', choix: { 'styles-rodeur': ['duel', 'defense'] } }, cat)).toMatch(/1/)
    expect(erreurMontee(rodeur, { classe: 'rodeur', choix: { 'styles-rodeur': ['duel'], metamagie: ['subtil'] } }, cat)).toMatch(/inattendu/)
    const apres = monter(rodeur, { classe: 'rodeur', choix: { 'styles-rodeur': ['duel'] } })
    expect(apres.regles.choix['styles-rodeur']).toEqual(['duel'])
  })

  it('ne repropose pas une option déjà prise (second style du champion)', () => {
    let fiche = ficheDe('guerrier', 1, { cat })
    fiche = monter(fiche, { classe: 'guerrier' })
    fiche = { ...fiche, regles: { ...fiche.regles, choix: { 'styles-guerrier': ['defense'] } } }
    for (let n = 3; n <= 9; n += 1) {
      const options = optionsDeMontee(fiche, cat)
      fiche = monter(fiche, {
        classe: 'guerrier', ...(options.sousClasse ? { sousClasse: 'champion' } : {}),
        ...(options.amelioration ? { amelioration: { caracs: { con: 1, sag: 1 } } } : {}),
      })
    }
    expect(ids(optionsDeMontee(fiche, cat).choix[0].options)).not.toContain('defense')
    expect(erreurMontee(fiche, { classe: 'guerrier', choix: { 'styles-guerrier': ['defense'] } }, cat)).toMatch(/option/)
  })

  it('passe l’expertise à 2 et ajoute les compétences du Collège du savoir', () => {
    const roublard = monter(ficheDe('roublard', 5, { sousClasse: 'voleur', competences: { perception: 1, athletisme: 1 } }), {
      classe: 'roublard', choix: { expertise: ['perception', 'outils-voleur'] },
    })
    expect(roublard.competences).toEqual({ perception: 2, athletisme: 1 })
    expect(roublard.regles.choix.expertise).toEqual(['perception', 'outils-voleur'])
    const barde = monter(ficheDe('barde', 2, { competences: { persuasion: 1, representation: 1 } }), {
      classe: 'barde', sousClasse: 'savoir', choix: { expertise: ['persuasion', 'representation'], competences: ['arcanes', 'histoire', 'nature'] },
    })
    expect(barde.competences).toEqual({ persuasion: 2, representation: 2, arcanes: 1, histoire: 1, nature: 1 })
  })

  it('refuse le multiclassage sans les caractéristiques requises', () => {
    expect(erreurMontee(ficheDe('clerc', 3, { sousClasse: 'vie' }), { classe: 'occultiste' }, cat)).toMatch(/Sagesse 13/)
  })

  it('refuse une demande mal formée', () => {
    expect(erreurMontee(ficheDe('guerrier', 4, { sousClasse: 'champion' }), null, cat)).toBeTruthy()
    expect(erreurMontee(ficheDe('guerrier', 4, { sousClasse: 'champion' }), { classe: 'guerrier', choix: 'x' }, cat)).toBeTruthy()
    expect(erreurMontee(ficheVierge('X'), { classe: 'guerrier' }, cat)).toMatch(/classe/)
  })
})

describe('annulerDerniereMontee', () => {
  it('rend la fiche exactement comme avant, choix, don, sous-classe et expertise compris', () => {
    const cas = [
      [ficheDe('guerrier', 2, { pvMax: 20 }), { classe: 'guerrier', sousClasse: 'champion' }],
      [ficheDe('guerrier', 3, { sousClasse: 'champion' }), { classe: 'guerrier', amelioration: { don: 'robuste' } }],
      [ficheDe('guerrier', 3, { sousClasse: 'champion', caracs: { con: 15 } }), { classe: 'guerrier', amelioration: { caracs: { con: 1, dex: 1 } } }],
      [ficheDe('roublard', 5, { sousClasse: 'voleur', competences: { perception: 1, athletisme: 1 } }), { classe: 'roublard', choix: { expertise: ['perception', 'athletisme'] } }],
      [ficheDe('rodeur', 1), { classe: 'rodeur', choix: { 'styles-rodeur': ['duel'] } }],
    ]
    for (const [avant, demande] of cas) expect(annulerDerniereMontee(monter(avant, demande), cat)).toEqual(avant)
  })

  it('refuse quand aucune montée n’a été faite sur le site', () => {
    expect(() => annulerDerniereMontee(ficheDe('guerrier', 3, { sousClasse: 'champion' }), cat)).toThrow(/montée/)
  })
})

describe('rattacher', () => {
  it('garde le reste de la fiche tel quel', () => {
    const fiche = { ...ficheVierge('Ivan'), niveau: 1, notes: 'à garder' }
    expect(rattacher(fiche, { classe: 'barbare' }, cat)).toMatchObject({ notes: 'à garder', classe: 'Barbare 1', desDeVie: '1d12' })
  })
})

describe('multiclassage', () => {
  const claire = (caracs = {}) => ficheDe('clerc', 3, { sousClasse: 'vie', caracs: { sag: 14, cha: 13, ...caracs } })

  it('liste les classes : celles déjà suivies, et les autres selon les caractéristiques requises', () => {
    const classes = classesPossibles(claire(), cat)
    expect(classes.find((c) => c.id === 'clerc')).toEqual({ id: 'clerc', nom: 'Clerc', niveau: 3, disponible: true, raison: null })
    expect(classes.find((c) => c.id === 'occultiste')).toEqual({ id: 'occultiste', nom: 'Occultiste', niveau: 0, disponible: true, raison: null })
    expect(classes.find((c) => c.id === 'magicien')).toMatchObject({ disponible: false, raison: 'Il faut Intelligence 13 (Magicien).' })
    expect(classes.find((c) => c.id === 'moine').raison).toBe('Il faut Dextérité 13 et Sagesse 13 (Moine).')
    expect(classesPossibles(ficheVierge('X'), cat)).toEqual([])
  })

  it('exige aussi les caractéristiques des classes déjà suivies, et accepte l’une ou l’autre pour le guerrier', () => {
    expect(classesPossibles(claire({ sag: 12 }), cat).find((c) => c.id === 'occultiste').raison).toBe('Il faut Sagesse 13 (Clerc).')
    expect(classesPossibles(claire({ for: 12, dex: 13 }), cat).find((c) => c.id === 'guerrier').disponible).toBe(true)
    expect(classesPossibles(claire({ for: 12, dex: 12 }), cat).find((c) => c.id === 'guerrier').raison).toBe('Il faut Force 13 ou Dextérité 13 (Guerrier).')
  })

  it('propose le premier niveau de la nouvelle classe : PV moyens, maîtrises, sous-classe s’il le faut', () => {
    const options = optionsDeMontee(claire(), cat, 'occultiste')
    expect(options).toMatchObject({
      possible: true, classe: { id: 'occultiste' }, niveauClasse: 1, niveauTotal: 4, pv: { de: 8, moyenne: 5, gain: 7 }, amelioration: null,
      aptitudes: ['Maîtrises du multiclassage : armures légères, armes courantes', 'Patron d’outre-monde', 'Magie de pacte'],
    })
    expect(ids(options.sousClasse)).toEqual(['fielon'])
  })

  it('ajoute la classe, puis fait monter chacune à son rythme', () => {
    let fiche = monter(claire(), { classe: 'occultiste', sousClasse: 'fielon' })
    expect(fiche).toMatchObject({ niveau: 4, classe: 'Clerc 3 (Domaine de la vie) / Occultiste 1 (Le Fiélon)', desDeVie: '4d8', pvMax: 27 })
    expect(fiche.regles.classes).toEqual([
      { classe: 'clerc', niveau: 3, sousClasse: 'vie' }, { classe: 'occultiste', niveau: 1, sousClasse: 'fielon' },
    ])
    expect(optionsDeMontee(fiche, cat, 'occultiste').choix).toMatchObject([{ cle: 'invocations', nombre: 2 }])
    fiche = monter(fiche, { classe: 'occultiste', choix: { invocations: ['vision-diable', 'armure-ombres'] } })
    expect(optionsDeMontee(fiche, cat, 'clerc')).toMatchObject({ niveauClasse: 4, niveauTotal: 6, amelioration: expect.any(Object) })
    expect(optionsDeMontee(fiche, cat, 'occultiste').amelioration).toBeNull()
  })

  it('demande les choix d’entrée dans la classe (compétence du roublard) et ceux de son premier niveau', () => {
    const guerrier = ficheDe('guerrier', 3, { sousClasse: 'champion', caracs: { dex: 14 }, competences: { athletisme: 1 } })
    const options = optionsDeMontee(guerrier, cat, 'roublard')
    expect(options.choix.map((c) => [c.cle, c.nombre])).toEqual([['competences', 1], ['expertise', 2]])
    expect(ids(options.choix[0].options)).not.toContain('athletisme')
    expect(ids(options.choix[0].options)).not.toContain('arcanes')
    const apres = monter(guerrier, { classe: 'roublard', choix: { competences: ['discretion'], expertise: ['athletisme', 'outils-voleur'] } })
    expect(apres.competences).toEqual({ athletisme: 2, discretion: 1 })
  })

  it('laisse mettre l’expertise sur la compétence gagnée au même niveau', () => {
    const guerrier = ficheDe('guerrier', 3, { sousClasse: 'champion', caracs: { dex: 14 }, competences: { athletisme: 1 } })
    expect(optionsDeMontee(guerrier, cat, 'roublard').choix[1].avecLesNouvelles).toBe(true)
    const apres = monter(guerrier, { classe: 'roublard', choix: { competences: ['discretion'], expertise: ['discretion', 'athletisme'] } })
    expect(apres.competences).toEqual({ athletisme: 2, discretion: 2 })
    expect(annulerDerniereMontee(apres, cat)).toEqual(guerrier)
    expect(erreurMontee(guerrier, { classe: 'roublard', choix: { competences: ['discretion'], expertise: ['perception', 'athletisme'] } }, cat)).toMatch(/option/)
  })

  it('ne repropose pas un style de combat déjà pris dans une autre classe', () => {
    const base = ficheDe('guerrier', 1, { caracs: { cha: 13 } })
    const guerrier = { ...base, regles: { ...base.regles, choix: { 'styles-guerrier': ['defense'] } } }
    const paladin = monter(guerrier, { classe: 'paladin' })
    expect(ids(optionsDeMontee(paladin, cat, 'paladin').choix[0].options)).toEqual(['duel', 'arme-a-deux-mains', 'protection'])
  })

  it('s’annule en retirant la classe ajoutée', () => {
    expect(annulerDerniereMontee(monter(claire(), { classe: 'occultiste', sousClasse: 'fielon' }), cat)).toEqual(claire())
  })

  it('rattache une fiche déjà multiclassée', () => {
    const fiche = rattacher({ ...ficheVierge('Claire'), niveau: 5 }, {
      classes: [{ classe: 'clerc', niveau: 3, sousClasse: 'vie' }, { classe: 'occultiste', niveau: 2, sousClasse: 'fielon' }],
    }, cat)
    expect(fiche).toMatchObject({ classe: 'Clerc 3 (Domaine de la vie) / Occultiste 2 (Le Fiélon)', desDeVie: '5d8' })
    expect(fiche.regles.pvDes).toEqual([8, 5, 5, 5, 5])
    const cinq = { ...ficheVierge('X'), niveau: 5 }
    expect(erreurRattachement(cinq, { classes: [{ classe: 'clerc', niveau: 3, sousClasse: 'vie' }, { classe: 'barbare', niveau: 1 }] }, cat)).toMatch(/total/)
    expect(erreurRattachement(cinq, { classes: [{ classe: 'barbare', niveau: 2 }, { classe: 'barbare', niveau: 3, sousClasse: 'berserker' }] }, cat)).toMatch(/deux fois/)
    expect(erreurRattachement(cinq, { classes: [{ classe: 'barbare', niveau: 0 }, { classe: 'barde', niveau: 5, sousClasse: 'savoir' }] }, cat)).toMatch(/niveau/)
    expect(erreurRattachement(cinq, { classes: [] }, cat)).toMatch(/classe/)
  })
})

describe('dons et sous-classes des livres', () => {
  const guerrier = (caracs = {}) => ficheDe('guerrier', 3, { sousClasse: 'champion', caracs, competences: { athletisme: 1 } })
  const avecDon = (don, reste = {}) => ({ classe: 'guerrier', amelioration: { don, ...reste.amelioration }, ...(reste.choix ? { choix: reste.choix } : {}) })
  const don = (fiche, id) => optionsDeMontee(fiche, cat).amelioration.dons.find((d) => d.id === id)

  it('accepte l’un ou l’autre prérequis (Intelligence ou Sagesse 13)', () => {
    expect(don(guerrier(), 'ritualiste')).toMatchObject({ disponible: false, raison: 'Intelligence 13 ou Sagesse 13 requise.' })
    expect(don(guerrier({ sag: 13 }), 'ritualiste').disponible).toBe(true)
  })

  it('montre sans bloquer un prérequis que le site ne peut pas vérifier', () => {
    expect(don(guerrier(), 'mage-de-guerre')).toMatchObject({ disponible: true, aVerifier: 'Capacité à lancer au moins un sort' })
  })

  it('ajoute la sauvegarde de la caractéristique choisie avec Résistant, et l’enlève à l’annulation', () => {
    const fiche = guerrier()
    const apres = monter(fiche, avecDon('resistant', { amelioration: { caracs: { sag: 1 } } }))
    expect(apres.caracteristiques.sag).toBe(11)
    expect(apres.sauvegardes).toEqual(['sag'])
    expect(apres.regles.montees.at(-1).sauvegarde).toBe('sag')
    expect(annulerDerniereMontee(apres, cat)).toEqual(fiche)
  })

  it('demande les choix propres au don, et seulement si on le prend', () => {
    const fiche = guerrier()
    expect(don(fiche, 'doue').choix).toMatchObject([{ cle: 'competences', nombre: 3 }])
    expect(erreurMontee(fiche, avecDon('doue'), cat)).toMatch(/Compétences/)
    expect(erreurMontee(fiche, { classe: 'guerrier', amelioration: { caracs: { for: 2 } }, choix: { competences: ['arcanes'] } }, cat)).toMatch(/inattendu/)
    const apres = monter(fiche, avecDon('doue', { choix: { competences: ['arcanes', 'histoire', 'nature'] } }))
    expect(apres.competences).toEqual({ athletisme: 1, arcanes: 1, histoire: 1, nature: 1 })
  })

  it('reprend un don répétable avec une autre option', () => {
    let fiche = monter(guerrier(), avecDon('adepte', { choix: { 'elements-test': ['feu'] } }))
    fiche = monter(fiche, { classe: 'guerrier' }) // le guerrier a sa prochaine amélioration au niveau 6
    expect(don(fiche, 'adepte')).toMatchObject({ disponible: true })
    expect(ids(don(fiche, 'adepte').choix[0].options)).toEqual(['froid'])
  })

  it('compte une sous-classe qui lance des sorts (tiers de lanceur)', async () => {
    const { emplacements } = await import('../../../src/domain/regles/emplacements.js')
    const fiche = monter(ficheDe('guerrier', 2), { classe: 'guerrier', sousClasse: 'chevalier-test' })
    expect(emplacements(fiche.regles, cat).sorts).toEqual([2])
    expect(optionsDeMontee(fiche, cat).aVenir).toEqual([expect.stringMatching(/sorts/i)])
  })

  it('donne directement l’expertise quand la sous-classe le dit (Domaine du savoir)', () => {
    const clerc = monter(ficheDe('magicien', 1, { caracs: { sag: 13, int: 13 } }), {
      classe: 'clerc', sousClasse: 'savoir-test', choix: { competences: ['arcanes', 'religion'] },
    })
    expect(clerc.competences).toEqual({ arcanes: 2, religion: 2 })
  })
})
