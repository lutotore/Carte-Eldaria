import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, inscrire, portailDeTest } from './aides.js'

const refus = (code) => expect.objectContaining({ code })

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = { tom: tomId }
  for (const [identifiant, role] of [['lea', 'joueur'], ['max', 'joueur'], ['zoe', 'mj']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  const qui = (nom) => ({ demandeurId: ids[nom], campagneId })
  const personnageId = portail.creerPersonnage({ ...qui('lea'), nom: 'Isaure' }).personnageId
  portail.modifierPersonnage({
    ...qui('lea'), personnageId,
    champs: { niveau: 2, pvMax: 20, pvActuels: 20, caracteristiques: { for: 16, dex: 14, con: 14, int: 8, sag: 10, cha: 10 } },
  })
  const fiche = (nom = 'lea') => portail.personnage({ ...qui(nom), personnageId }).fiche
  return { ...outils, ids, qui, personnageId, fiche }
}

describe('rattacher une fiche aux règles', () => {
  it('propose les classes tant que la fiche ne suit pas les règles', async () => {
    const { portail, qui, personnageId } = await table()
    const { rattachement, options } = portail.optionsMontee({ ...qui('lea'), personnageId })
    expect(options).toBeUndefined()
    expect(rattachement.niveau).toBe(2)
    expect(rattachement.classes.find((c) => c.id === 'guerrier')).toEqual({
      id: 'guerrier', nom: 'Guerrier', niveauSousClasse: 3, sousClasses: [{ id: 'champion', nom: 'Champion' }],
    })
    expect(rattachement.dons).toEqual([{ id: 'lutteur', nom: 'Lutteur' }])
  })

  it('joint à la fiche ses aptitudes d’après les règles, et rien pour une fiche libre', async () => {
    const { portail, qui, personnageId } = await table()
    expect(portail.personnage({ ...qui('lea'), personnageId }).regles).toBeNull()
    portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classe: 'guerrier', dons: ['lutteur'] })
    const { regles } = portail.personnage({ ...qui('lea'), personnageId })
    expect(regles.classes[0]).toMatchObject({ nom: 'Guerrier', niveau: 2, niveaux: [{ niveau: 1 }, { niveau: 2 }] })
    expect(regles.dons.map((d) => d.nom)).toEqual(['Lutteur'])
  })

  it('se fait par le joueur ou un MJ, et refuse une classe inconnue', async () => {
    const { portail, qui, personnageId, fiche } = await table()
    expect(() => portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classe: 'pirate' })).toThrow(refus('requete_invalide'))
    expect(() => portail.rattacherAuxRegles({ ...qui('max'), personnageId, classe: 'guerrier' })).toThrow(refus('introuvable'))
    portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classe: 'guerrier' })
    expect(fiche()).toMatchObject({ classe: 'Guerrier 2', desDeVie: '2d10', regles: { classes: [{ classe: 'guerrier', niveau: 2 }] } })
  })
})

describe('monter de niveau', () => {
  it('applique la montée validée par le moteur, et prévient les MJ', async () => {
    const { portail, qui, ids, personnageId, fiche } = await table()
    portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classe: 'guerrier' })
    expect(portail.optionsMontee({ ...qui('lea'), personnageId }).options).toMatchObject({ niveauTotal: 3, sousClasse: [{ id: 'champion' }] })
    portail.monterDeNiveau({ ...qui('lea'), personnageId, demande: { classe: 'guerrier', sousClasse: 'champion' } })
    expect(fiche()).toMatchObject({ niveau: 3, classe: 'Guerrier 3 (Champion)', pvMax: 28 })
    for (const mj of ['tom', 'zoe']) {
      expect(portail.notifications({ demandeurId: ids[mj] }).liste[0]).toMatchObject({
        texte: 'Isaure passe au niveau 3 : Guerrier 3 (Champion).', lien: expect.stringContaining(`/personnages/${personnageId}`),
      })
    }
    expect(portail.notifications({ demandeurId: ids.lea }).liste).toEqual([])
  })

  it('refuse une montée qui ne respecte pas les règles, sans rien écrire', async () => {
    const { portail, qui, personnageId, fiche } = await table()
    portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classe: 'guerrier' })
    expect(() => portail.monterDeNiveau({ ...qui('lea'), personnageId, demande: { classe: 'guerrier' } })).toThrow(refus('requete_invalide'))
    expect(() => portail.monterDeNiveau({ ...qui('lea'), personnageId, demande: { classe: 'guerrier', sousClasse: 'champion', amelioration: { caracs: { for: 2 } } } }))
      .toThrow(refus('requete_invalide'))
    expect(fiche().niveau).toBe(2)
  })

  it('refuse une fiche qui ne suit pas les règles', async () => {
    const { portail, qui, personnageId } = await table()
    expect(() => portail.monterDeNiveau({ ...qui('lea'), personnageId, demande: { classe: 'guerrier' } })).toThrow(refus('requete_invalide'))
  })

  it('s’annule, la dernière montée seulement', async () => {
    const { portail, qui, personnageId, fiche } = await table()
    portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classe: 'guerrier' })
    const avant = fiche()
    portail.monterDeNiveau({ ...qui('lea'), personnageId, demande: { classe: 'guerrier', sousClasse: 'champion' } })
    expect(portail.optionsMontee({ ...qui('lea'), personnageId }).annulable).toEqual({ niveau: 3, classe: 'guerrier' })
    portail.annulerMontee({ ...qui('lea'), personnageId })
    expect(fiche()).toEqual(avant)
    expect(() => portail.annulerMontee({ ...qui('lea'), personnageId })).toThrow(refus('requete_invalide'))
  })

  it('prend un niveau dans une nouvelle classe, selon les caractéristiques requises', async () => {
    const { portail, qui, personnageId, fiche } = await table()
    portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classe: 'guerrier' })
    const etat = portail.optionsMontee({ ...qui('lea'), personnageId, classe: 'roublard' })
    expect(etat.options).toMatchObject({ classe: { id: 'roublard' }, niveauClasse: 1, niveauTotal: 3 })
    expect(etat.classes.find((c) => c.id === 'magicien')).toMatchObject({ disponible: false })
    expect(portail.optionsMontee({ ...qui('lea'), personnageId, classe: 'magicien' }).options).toMatchObject({ possible: false })
    portail.monterDeNiveau({
      ...qui('lea'), personnageId, demande: { classe: 'roublard', choix: { competences: ['discretion'], expertise: ['discretion', 'outils-voleur'] } },
    })
    expect(fiche().classe).toBe('Guerrier 2 / Roublard 1')
  })

  it('rattache une fiche déjà multiclassée', async () => {
    const { portail, qui, personnageId, fiche } = await table()
    portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classes: [{ classe: 'guerrier', niveau: 1 }, { classe: 'roublard', niveau: 1 }] })
    expect(fiche().desDeVie).toBe('1d10 + 1d8')
    expect(() => portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classes: 'x' })).toThrow(refus('requete_invalide'))
  })

  it('ne laisse plus changer à la main le niveau, la classe ni les dés de vie d’une fiche qui suit les règles', async () => {
    const { portail, qui, personnageId } = await table()
    portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classe: 'guerrier' })
    expect(() => portail.modifierPersonnage({ ...qui('lea'), personnageId, champs: { niveau: 5 } })).toThrow(refus('requete_invalide'))
    portail.modifierPersonnage({ ...qui('lea'), personnageId, champs: { pvActuels: 4 } })
  })

  it('se détache des règles pour revenir à une fiche libre', async () => {
    const { portail, qui, personnageId, fiche } = await table()
    portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classe: 'guerrier' })
    portail.detacherDesRegles({ ...qui('zoe'), personnageId })
    expect(fiche().regles).toBeNull()
    portail.modifierPersonnage({ ...qui('lea'), personnageId, champs: { niveau: 5 } })
  })
})

describe('sorts', () => {
  const LIVRE = 'Test'
  const sort = (id, niveau, classes) => ({ type: 'sort', id, nom: id, niveau, ecole: 'évocation', classes, source: LIVRE })
  const SORTS = [sort('lumiere', 0, ['clerc']), sort('thaumaturgie', 0, ['clerc']), sort('flamme-sacree', 0, ['clerc']), sort('assistance', 0, ['clerc']),
    sort('soin', 1, ['clerc']), sort('benediction', 1, ['clerc']), sort('injonction', 1, ['clerc']), sort('aide', 2, ['clerc'])]

  async function clerc() {
    const outils = await table()
    const { portail, qui, personnageId } = outils
    portail.importerRegles({ livre: LIVRE, elements: SORTS })
    portail.modifierPersonnage({ ...qui('lea'), personnageId, champs: { caracteristiques: { for: 10, dex: 10, con: 10, int: 10, sag: 14, cha: 10 } } })
    portail.rattacherAuxRegles({ ...qui('lea'), personnageId, classe: 'clerc', sousClasse: 'vie' })
    return outils
  }

  it('joint à la fiche ce que chaque classe peut lancer', async () => {
    const { portail, qui, personnageId } = await clerc()
    const [etat] = portail.personnage({ ...qui('lea'), personnageId }).sorts
    expect(etat).toMatchObject({ classe: 'clerc', mode: 'prepares', limites: { toursDeMagie: 3, prepares: 4 }, niveauMax: 1 })
    expect(etat.options.sorts).toEqual(['soin', 'benediction', 'injonction'])
  })

  it('enregistre une sélection juste, refuse les autres', async () => {
    const { portail, qui, personnageId } = await clerc()
    portail.choisirSorts({ ...qui('lea'), personnageId, classe: 'clerc', selection: { toursDeMagie: ['lumiere', 'thaumaturgie'], prepares: ['soin'] } })
    expect(portail.personnage({ ...qui('lea'), personnageId }).sorts[0].choisis).toMatchObject({ toursDeMagie: ['lumiere', 'thaumaturgie'], prepares: ['soin'] })
    expect(() => portail.choisirSorts({ ...qui('lea'), personnageId, classe: 'clerc', selection: { prepares: ['aide'] } })).toThrow(refus('requete_invalide'))
    expect(() => portail.choisirSorts({ ...qui('max'), personnageId, classe: 'clerc', selection: {} })).toThrow(refus('introuvable'))
  })

  it('ne donne rien à une fiche libre', async () => {
    const { portail, qui, personnageId } = await table()
    expect(portail.personnage({ ...qui('lea'), personnageId }).sorts).toEqual([])
    expect(() => portail.choisirSorts({ ...qui('lea'), personnageId, classe: 'clerc', selection: {} })).toThrow(refus('requete_invalide'))
  })
})
