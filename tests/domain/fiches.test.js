import { describe, expect, it } from 'vitest'
import {
  ATTITUDES, erreurFacette, erreurNote, etatDeRevelation, FACETTES_PNJ, STATUTS, vueJoueur,
} from '../../src/domain/fiches.js'

const fiche = { id: 1, type: 'pnj', notesMj: 'SECRET-MJ' }
const facette = (id, cle, valeur, revelations = [], titre = null) => ({ id, cle, titre, valeur, revelations })
const auGroupe = [{ pourTous: true, utilisateurId: null }]
const a = (utilisateurId) => [{ pourTous: false, utilisateurId }]

describe('facettes d’un PNJ', () => {
  it('suivent un ordre fixe', () => {
    expect(FACETTES_PNJ).toEqual(['nom', 'portrait', 'role', 'faction', 'lieu', 'attitude', 'statut', 'description'])
    expect(ATTITUDES.map((x) => x.cle)).toEqual(['allie', 'amical', 'neutre', 'mefiant', 'hostile'])
    expect(STATUTS.map((x) => x.cle)).toEqual(['vivant', 'mort', 'disparu', 'inconnu'])
  })

  it('valident leurs valeurs', () => {
    expect(erreurFacette('attitude', 'hostile')).toBeNull()
    expect(erreurFacette('attitude', 'amoureux')).not.toBeNull()
    expect(erreurFacette('statut', 'mort')).toBeNull()
    expect(erreurFacette('statut', 'zombie')).not.toBeNull()
    expect(erreurFacette('nom', '')).not.toBeNull()
    expect(erreurFacette('nom', 'x'.repeat(81))).not.toBeNull()
    expect(erreurFacette('description', 'x'.repeat(4000))).toBeNull()
    expect(erreurFacette('description', 'x'.repeat(4001))).not.toBeNull()
    expect(erreurFacette('secret', 'Elle est la fille d’Élise.')).toBeNull()
    expect(erreurFacette('role', 42)).not.toBeNull()
  })
})

describe('ce que voit un joueur', () => {
  const facettes = [
    facette(10, 'nom', 'Isaure Mervent', auGroupe),
    facette(11, 'portrait', 'img-1'),
    facette(12, 'role', 'Recruteuse', auGroupe),
    facette(13, 'faction', 'Compagnie', a(7)),
    facette(14, 'secret', 'Fille d’Élise', a(8), 'Sa mère'),
    facette(15, 'description', ''),
  ]

  it('ne montre que les facettes révélées au groupe ou à lui, jamais les notes du MJ', () => {
    const vue = vueJoueur(fiche, facettes, 7)
    expect(vue).toEqual({
      id: 1,
      type: 'pnj',
      nom: 'Isaure Mervent',
      facettes: [
        { id: 12, cle: 'role', titre: null, valeur: 'Recruteuse', pourMoiSeul: false },
        { id: 13, cle: 'faction', titre: null, valeur: 'Compagnie', pourMoiSeul: true },
      ],
      portrait: null,
    })
    expect(JSON.stringify(vue)).not.toMatch(/SECRET-MJ|Élise|img-1/)
  })

  it('montre un secret au seul joueur à qui il a été révélé', () => {
    expect(vueJoueur(fiche, facettes, 8).facettes.map((f) => f.cle)).toEqual(['role', 'secret'])
  })

  it('présente un PNJ dont le nom est encore inconnu', () => {
    const anonyme = [facette(10, 'nom', 'Maëlis Corvane'), facette(12, 'description', 'Une prêcheuse en capuche grise.', auGroupe)]
    expect(vueJoueur(fiche, anonyme, 7)).toMatchObject({ nom: null, facettes: [{ cle: 'description' }] })
  })

  it('donne le portrait seulement s’il est révélé', () => {
    const avecPortrait = [facette(10, 'nom', 'Pip', auGroupe), facette(11, 'portrait', 'img-9', auGroupe)]
    expect(vueJoueur(fiche, avecPortrait, 7).portrait).toBe('img-9')
  })

  it("rend null quand rien n'est révélé : le PNJ n'existe pas pour ce joueur", () => {
    expect(vueJoueur(fiche, [facette(10, 'nom', 'Odalie Vashter', a(99))], 7)).toBeNull()
  })

  it("ignore une facette révélée mais vide", () => {
    expect(vueJoueur(fiche, [facette(10, 'nom', 'Pip', auGroupe), facette(12, 'role', '', auGroupe)], 7).facettes).toEqual([])
  })
})

describe('état de révélation, pour le MJ', () => {
  it('distingue caché, partiellement révélé et entièrement révélé au groupe', () => {
    expect(etatDeRevelation([facette(1, 'nom', 'A'), facette(2, 'role', 'B')])).toBe('cache')
    expect(etatDeRevelation([facette(1, 'nom', 'A', auGroupe), facette(2, 'role', 'B')])).toBe('partiel')
    expect(etatDeRevelation([facette(1, 'nom', 'A', a(3)), facette(2, 'role', '')])).toBe('partiel')
    expect(etatDeRevelation([facette(1, 'nom', 'A', auGroupe), facette(2, 'role', '')])).toBe('revele')
  })
})

describe('notes des joueurs', () => {
  it('acceptent une note ou une croyance, privée ou partagée', () => {
    expect(erreurNote({ type: 'note', visibilite: 'privee', texte: 'Il ment.' })).toBeNull()
    expect(erreurNote({ type: 'croyance', visibilite: 'groupe', texte: 'Elle travaille pour l’Abîme.' })).toBeNull()
  })

  it('refusent le reste', () => {
    expect(erreurNote({ type: 'rumeur', visibilite: 'privee', texte: 'x' })).not.toBeNull()
    expect(erreurNote({ type: 'note', visibilite: 'publique', texte: 'x' })).not.toBeNull()
    expect(erreurNote({ type: 'note', visibilite: 'privee', texte: '   ' })).not.toBeNull()
    expect(erreurNote({ type: 'note', visibilite: 'privee', texte: 'x'.repeat(2001) })).not.toBeNull()
  })
})

describe('créatures du bestiaire', () => {
  it('ont leurs propres facettes, en ordre de bloc de statistiques', async () => {
    const { FACETTES_PAR_TYPE, TITREES_PAR_TYPE, ESTIMABLES } = await import('../../src/domain/fiches.js')
    expect(FACETTES_PAR_TYPE.creature).toEqual([
      'nom', 'portrait', 'nature', 'description', 'habitat', 'ca', 'pv', 'vitesse', 'caracteristiques', 'sauvegardes', 'competences', 'defenses', 'sens', 'langues',
    ])
    expect(FACETTES_PAR_TYPE.pnj).toEqual(FACETTES_PNJ)
    expect(TITREES_PAR_TYPE).toEqual({ pnj: ['secret'], creature: ['capacite', 'action', 'reaction', 'secret'] })
    expect(ESTIMABLES).toEqual(['nature', 'ca', 'pv', 'vitesse', 'caracteristiques', 'sauvegardes', 'competences', 'defenses', 'sens', 'langues'])
  })

  it('valident les facettes propres aux créatures', () => {
    expect(erreurFacette('ca', '14 (armure naturelle)')).toBeNull()
    expect(erreurFacette('action', 'Griffes : +4 au toucher.')).toBeNull()
    expect(erreurFacette('caracteristiques', 'x'.repeat(301))).not.toBeNull()
  })
})

describe('estimations des joueurs', () => {
  it('montrent la vraie valeur une fois révélée, sinon l’estimation du groupe', async () => {
    const { grilleEstimations } = await import('../../src/domain/fiches.js')
    const facettes = [
      facette(1, 'ca', '13 (armure naturelle)', auGroupe),
      facette(2, 'pv', '45 (7d8 + 14)'),
      facette(3, 'vitesse', '9 m', a(8)),
    ]
    const estimations = { ca: { texte: 'autour de 14', auteur: 'lea' }, pv: { texte: 'une trentaine', auteur: 'max' } }
    const grille = grilleEstimations(facettes, estimations, 7)
    expect(grille.find((l) => l.cle === 'ca')).toEqual({ cle: 'ca', valeur: '13 (armure naturelle)', estimation: { texte: 'autour de 14', auteur: 'lea' } })
    expect(grille.find((l) => l.cle === 'pv')).toEqual({ cle: 'pv', valeur: null, estimation: { texte: 'une trentaine', auteur: 'max' } })
    expect(grille.find((l) => l.cle === 'vitesse')).toEqual({ cle: 'vitesse', valeur: null, estimation: null })
    expect(grille.map((l) => l.cle)).toEqual(['nature', 'ca', 'pv', 'vitesse', 'caracteristiques', 'sauvegardes', 'competences', 'defenses', 'sens', 'langues'])
  })
})

describe('grille des estimations', () => {
  it("signale une valeur révélée à ce seul joueur", async () => {
    const { grilleEstimations } = await import('../../src/domain/fiches.js')
    const grille = grilleEstimations([facette(3, 'vitesse', '9 m', a(7))], {}, 7)
    expect(grille.find((l) => l.cle === 'vitesse')).toEqual({ cle: 'vitesse', valeur: '9 m', estimation: null, pourMoiSeul: true })
  })

  it('donne la longueur maximale de chaque facette', async () => {
    const { longueurMax } = await import('../../src/domain/fiches.js')
    expect([longueurMax('role'), longueurMax('ca'), longueurMax('caracteristiques'), longueurMax('nom')]).toEqual([200, 120, 300, 80])
  })
})

