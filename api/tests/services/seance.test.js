import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, etatExemple, inscrire, portailDeTest } from './aides.js'

const refus = (code) => expect.objectContaining({ code })

const FICHES = [
  { type: 'lieu', nom: 'Le Nid des Fileurs', facettes: { description: 'Des fils de brume partout.', ambiance: 'Froid humide.' }, secrets: [{ titre: 'Le trou', texte: 'Il mène aux échafaudages.' }] },
  { type: 'creature', nom: 'Fileur de brume', facettes: { description: 'Une ombre à contretemps.', ca: '13' }, secrets: [{ titre: 'Faiblesse', texte: 'La lumière d’une Larme la dissipe.' }] },
  { type: 'objet', nom: 'La pioche de Garrec', facettes: { apparence: 'Manche gravé « G ».' } },
  { type: 'pnj', nom: 'Crouvier', facettes: { role: 'Contremaître' } },
]

const SCENES = {
  scenes: [
    {
      titre: 'Le Nid des Fileurs', sousTitre: 'Salle 1', butin: 'Le Nid',
      elements: [
        { type: 'lieu', nom: 'Le Nid des Fileurs', facettes: ['nom', 'description'] },
        { type: 'creature', nom: 'Fileur de brume', facettes: ['nom', 'description', 'secret:Faiblesse'] },
        { type: 'objet', nom: 'La pioche de Garrec' },
      ],
    },
    { titre: 'Le Carrefour qui change', elements: [{ type: 'pnj', nom: 'Crouvier', facettes: ['nom'] }], suite: 'Vers le Puits.' },
  ],
}

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = { tom: tomId }
  for (const [identifiant, role] of [['zoe', 'mj'], ['lea', 'joueur'], ['max', 'joueur']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  const qui = (nom) => ({ demandeurId: ids[nom], campagneId })
  portail.importerFiches(campagneId, { fiches: FICHES, butins: [{ titre: 'Le Nid', pieces: { pp: 0, po: 0, pe: 0, pa: 0, pc: 0 }, objets: [{ nom: 'Larme brute', quantite: 4 }] }] })
  const scenes = () => portail.scenes(qui('tom')).scenes
  const vues = (nom, type) => portail.bibliotheque({ ...qui(nom), type }).fiches
  const notifs = (nom) => portail.notifications({ demandeurId: ids[nom] }).liste
  return { ...outils, campagneId, ids, qui, scenes, vues, notifs }
}

async function tableAvecScenes() {
  const t = await table()
  t.portail.importerScenes(t.campagneId, SCENES)
  return t
}

describe('import des scènes préparées', () => {
  it('relie chaque élément à sa fiche par type et par nom, et le butin par son titre', async () => {
    const { portail, campagneId, scenes } = await table()
    expect(portail.importerScenes(campagneId, SCENES)).toEqual({ scenes: 2, fichesCreees: 0, introuvables: [] })
    const [nid, carrefour] = scenes()
    expect(nid).toMatchObject({
      titre: 'Le Nid des Fileurs', sousTitre: 'Salle 1', suite: '',
      butin: { titre: 'Le Nid', statut: 'prepare', resume: 'Larme brute ×4' },
      elements: [
        { type: 'lieu', nom: 'Le Nid des Fileurs', quoi: 'Nom, Description', etat: 'cache' },
        { type: 'creature', nom: 'Fileur de brume', quoi: 'Nom, Description, Faiblesse', etat: 'cache' },
        { type: 'objet', nom: 'La pioche de Garrec', quoi: 'Tout ce qui est rempli', etat: 'cache' },
      ],
    })
    expect(carrefour).toMatchObject({ titre: 'Le Carrefour qui change', butin: null, suite: 'Vers le Puits.' })
  })

  it('remplace les scènes déjà importées', async () => {
    const { portail, campagneId, scenes } = await table()
    portail.importerScenes(campagneId, SCENES)
    portail.importerScenes(campagneId, { scenes: [SCENES.scenes[1]] })
    expect(scenes().map((s) => s.titre)).toEqual(['Le Carrefour qui change'])
  })

  it('crée les fiches fournies qui manquent, sans doubler celles qui existent', async () => {
    const { portail, campagneId, vues } = await table()
    const resultat = portail.importerScenes(campagneId, {
      fiches: [FICHES[0], { type: 'creature', nom: 'Veilleur creux', facettes: { description: 'Sans ombre.' } }],
      scenes: [{ titre: 'Antre', elements: [{ type: 'creature', nom: 'Veilleur creux' }] }],
    })
    expect(resultat).toMatchObject({ fichesCreees: 1, introuvables: [] })
    expect(vues('tom', 'lieu').filter((f) => f.nom === 'Le Nid des Fileurs')).toHaveLength(1)
    expect(vues('tom', 'creature').map((f) => f.nom)).toContain('Veilleur creux')
  })

  it('signale les fiches et butins introuvables, et garde le reste', async () => {
    const { portail, campagneId, scenes } = await table()
    const resultat = portail.importerScenes(campagneId, {
      scenes: [{ titre: 'Puits', butin: 'Inconnu', elements: [{ type: 'pnj', nom: 'Personne' }, { type: 'pnj', nom: 'Crouvier' }] }],
    })
    expect(resultat.introuvables).toEqual(['pnj « Personne »', 'butin « Inconnu »'])
    expect(scenes()[0].elements.map((e) => e.nom)).toEqual(['Crouvier'])
  })

  it('refuse un fichier mal formé sans rien écrire', async () => {
    const { portail, campagneId, scenes } = await table()
    portail.importerScenes(campagneId, SCENES)
    expect(() => portail.importerScenes(campagneId, { scenes: [{ titre: '', elements: [] }] })).toThrow(refus('requete_invalide'))
    expect(() => portail.importerScenes(campagneId, { rien: true })).toThrow(refus('requete_invalide'))
    expect(scenes()).toHaveLength(2)
  })
})

describe('les scènes au pupitre', () => {
  it('sont réservées aux MJ', async () => {
    const { portail, qui } = await tableAvecScenes()
    expect(portail.scenes(qui('zoe')).scenes).toHaveLength(2)
    expect(() => portail.scenes(qui('lea'))).toThrow(refus('interdit'))
  })

  it('donnent la liste des joueurs, pour révéler à certains seulement', async () => {
    const { portail, qui } = await tableAvecScenes()
    expect(portail.scenes(qui('tom')).joueurs.map((j) => j.identifiant)).toEqual(['lea', 'max'])
  })
})

describe('révéler une scène', () => {
  it("d'un geste au groupe : seulement les facettes visées, et une notification par joueur", async () => {
    const { portail, qui, scenes, vues, notifs } = await tableAvecScenes()
    const [nid] = scenes()
    portail.revelerScene({ ...qui('tom'), sceneId: nid.id, pourTous: true })
    expect(scenes()[0].elements.map((e) => e.etat)).toEqual(['revele', 'revele', 'revele'])
    const fileur = vues('lea', 'creature')[0]
    expect(fileur.nom).toBe('Fileur de brume')
    expect(fileur.facettes.map((f) => f.titre ?? f.cle)).toEqual(['description', 'Faiblesse'])
    expect(vues('lea', 'lieu')[0].facettes.map((f) => f.cle)).toEqual(['description'])
    expect(notifs('lea').map((n) => n.texte)).toEqual(['Nouvelles informations : Le Nid des Fileurs, Fileur de brume et La pioche de Garrec.'])
    expect(notifs('max')).toHaveLength(1)
    expect(notifs('zoe')).toEqual([])
  })

  it("compte une seule fois une fiche présente dans plusieurs éléments", async () => {
    const { portail, qui, notifs, campagneId } = await table()
    portail.importerScenes(campagneId, { scenes: [{ titre: 'Nid', elements: [
      { type: 'creature', nom: 'Fileur de brume', facettes: ['nom'] },
      { type: 'creature', nom: 'Fileur de brume', facettes: ['secret:Faiblesse'] },
      { type: 'pnj', nom: 'Crouvier', facettes: ['nom'] },
    ] }] })
    const [nid] = portail.scenes(qui('tom')).scenes
    portail.revelerScene({ ...qui('tom'), sceneId: nid.id, pourTous: true })
    expect(notifs('lea').map((n) => n.texte)).toEqual(['Nouvelles informations : Fileur de brume et Crouvier.'])
    expect(portail.scenes(qui('tom')).scenes[0].elements.map((e) => e.etat)).toEqual(['revele', 'revele', 'revele'])
  })

  it('élément par élément', async () => {
    const { portail, qui, scenes, notifs, campagneId } = await tableAvecScenes()
    const [nid] = scenes()
    portail.revelerScene({ ...qui('tom'), sceneId: nid.id, element: 1, pourTous: true })
    expect(scenes()[0].elements.map((e) => e.etat)).toEqual(['cache', 'revele', 'cache'])
    expect(notifs('lea')[0]).toMatchObject({
      texte: 'Nouvelle information : Fileur de brume.', lien: `/campagne/${campagneId}/bestiaire/${nid.elements[1].ficheId}`,
    })
  })

  it('à certains joueurs seulement, sans retirer ce que d’autres savaient déjà', async () => {
    const { portail, qui, ids, scenes, vues, notifs } = await tableAvecScenes()
    const [nid] = scenes()
    portail.revelerScene({ ...qui('tom'), sceneId: nid.id, element: 2, pourTous: false, joueurs: [ids.lea] })
    portail.revelerScene({ ...qui('tom'), sceneId: nid.id, element: 2, pourTous: false, joueurs: [ids.max] })
    expect(vues('lea', 'objet')).toHaveLength(1)
    expect(vues('max', 'objet')).toHaveLength(1)
    expect(scenes()[0].elements[2].etat).toBe('partiel')
    expect(notifs('lea')).toHaveLength(1)
  })

  it('se défait : un élément peut être caché à nouveau', async () => {
    const { portail, qui, scenes, vues } = await tableAvecScenes()
    const [nid] = scenes()
    portail.revelerScene({ ...qui('tom'), sceneId: nid.id, pourTous: true })
    portail.revelerScene({ ...qui('tom'), sceneId: nid.id, element: 1, masquer: true })
    expect(scenes()[0].elements[1].etat).toBe('cache')
    expect(vues('lea', 'creature')).toEqual([])
  })

  it('ne prévient pas deux fois ceux qui savaient déjà', async () => {
    const { portail, qui, scenes, notifs } = await tableAvecScenes()
    const [nid] = scenes()
    portail.revelerScene({ ...qui('tom'), sceneId: nid.id, pourTous: true })
    portail.revelerScene({ ...qui('tom'), sceneId: nid.id, pourTous: true })
    expect(notifs('lea')).toHaveLength(1)
  })

  it('refuse un joueur étranger, un élément inconnu, un joueur demandeur', async () => {
    const { portail, qui, ids, scenes } = await tableAvecScenes()
    const [nid] = scenes()
    expect(() => portail.revelerScene({ ...qui('tom'), sceneId: nid.id, pourTous: false, joueurs: [ids.zoe] })).toThrow(refus('requete_invalide'))
    expect(() => portail.revelerScene({ ...qui('tom'), sceneId: nid.id, element: 9, pourTous: true })).toThrow(refus('introuvable'))
    expect(() => portail.revelerScene({ ...qui('tom'), sceneId: 999, pourTous: true })).toThrow(refus('introuvable'))
    expect(() => portail.revelerScene({ ...qui('lea'), sceneId: nid.id, pourTous: true })).toThrow(refus('interdit'))
  })

  it("ignore l'élément dont la fiche a été supprimée", async () => {
    const { portail, qui, scenes } = await tableAvecScenes()
    const [nid] = scenes()
    portail.supprimerFiche({ ...qui('tom'), ficheId: nid.elements[2].ficheId })
    expect(scenes()[0].elements.map((e) => e.nom)).toEqual(['Le Nid des Fileurs', 'Fileur de brume'])
    portail.revelerScene({ ...qui('tom'), sceneId: nid.id, pourTous: true })
  })
})

describe('révéler plusieurs fiches d’un coup (bibliothèque)', () => {
  it('révèle tout ce qui est rempli des fiches choisies, avec une seule notification', async () => {
    const { portail, qui, vues, notifs } = await table()
    const lieu = vues('tom', 'lieu')[0].id
    const pnj = vues('tom', 'pnj')[0].id
    portail.revelerEnLot({ ...qui('tom'), fiches: [lieu, pnj], pourTous: true })
    expect(vues('lea', 'lieu')[0].facettes.map((f) => f.titre ?? f.cle)).toEqual(['description', 'ambiance', 'Le trou'])
    expect(vues('lea', 'pnj')[0].nom).toBe('Crouvier')
    expect(notifs('lea').map((n) => n.texte)).toEqual(['Nouvelles informations : Le Nid des Fileurs et Crouvier.'])
  })

  it("refuse une fiche d'une autre campagne", async () => {
    const { portail, qui } = await table()
    expect(() => portail.revelerEnLot({ ...qui('tom'), fiches: [9999], pourTous: true })).toThrow(refus('introuvable'))
  })
})

describe('note de séance', () => {
  it('va au Journal du monde, et change sa version', async () => {
    const { portail, qui, campagneId } = await table()
    portail.importerEtat(campagneId, etatExemple())
    const avant = portail.lireEtat(qui('tom'))
    portail.noterAuJournal({ ...qui('tom'), texte: '  Le rôdeur a gardé la Larme ronde.  ' })
    const apres = portail.lireEtat(qui('tom'))
    expect(apres.etat.journal[0]).toMatchObject({ texte: 'Le rôdeur a gardé la Larme ronde.', d: 0 })
    expect(apres.version).toBe(avant.version + 1)
  })

  it('est réservée aux MJ et ne peut pas être vide', async () => {
    const { portail, qui, campagneId } = await table()
    portail.importerEtat(campagneId, etatExemple())
    expect(() => portail.noterAuJournal({ ...qui('lea'), texte: 'x' })).toThrow(refus('interdit'))
    expect(() => portail.noterAuJournal({ ...qui('tom'), texte: '  ' })).toThrow(refus('requete_invalide'))
    expect(() => portail.noterAuJournal({ ...qui('tom'), texte: 'x'.repeat(501) })).toThrow(refus('requete_invalide'))
  })
})
