import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, inscrire, MDP, portailDeTest } from './aides.js'

const bourse = (x = {}) => ({ pp: 0, po: 0, pe: 0, pa: 0, pc: 0, ...x })
const refus = (code) => expect.objectContaining({ code })

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = { tom: tomId }
  for (const [identifiant, role] of [['lea', 'joueur'], ['max', 'joueur'], ['ocre', 'occasionnel'], ['zoe', 'mj']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  const qui = (nom) => ({ demandeurId: ids[nom], campagneId })
  const creer = (nom, perso = nom.toUpperCase()) => portail.creerPersonnage({ ...qui(nom), nom: perso }).personnageId
  return { ...outils, campagneId, ids, qui, creer }
}

describe('fiche de personnage', () => {
  it('chaque joueur crée la sienne, une seule par campagne, à partir d’une fiche vierge', async () => {
    const { portail, qui, creer } = await table()
    const id = creer('lea', 'Isaure')
    const fiche = portail.personnage({ ...qui('lea'), personnageId: id })
    expect(fiche).toMatchObject({ id, joueur: 'lea', fiche: { nom: 'Isaure', niveau: 1 }, bourse: bourse(), inventaire: [], marques: [] })
    expect(fiche.calculs).toMatchObject({ maitrise: 2, perceptionPassive: 10 })
    expect(portail.personnages(qui('lea'))).toEqual({ estMj: false, personnageId: id })
    expect(() => creer('lea', 'Bis')).toThrow(refus('requete_invalide'))
    expect(() => portail.creerPersonnage({ ...qui('lea'), nom: ' ' })).toThrow(refus('requete_invalide'))
  })

  it('les occasionnels en ont une aussi, pas les MJ', async () => {
    const { creer } = await table()
    expect(creer('ocre')).toBeTypeOf('number')
    expect(() => creer('zoe')).toThrow(refus('interdit'))
    expect(() => creer('tom')).toThrow(refus('interdit'))
  })

  it('ne se lit que par son joueur et par les MJ', async () => {
    const { portail, qui, creer } = await table()
    const id = creer('lea')
    creer('max')
    expect(() => portail.personnage({ ...qui('max'), personnageId: id })).toThrow(refus('introuvable'))
    expect(portail.personnage({ ...qui('zoe'), personnageId: id }).joueur).toBe('lea')
    const liste = portail.personnages(qui('tom'))
    expect(liste.estMj).toBe(true)
    expect(liste.personnages.map((p) => [p.joueur, p.nom])).toEqual([['lea', 'LEA'], ['max', 'MAX']])
  })

  it('se modifie champ par champ par son joueur ou un MJ, jamais par un autre joueur', async () => {
    const { portail, qui, creer } = await table()
    const personnageId = creer('lea')
    portail.modifierPersonnage({ ...qui('lea'), personnageId, champs: { classe: 'Roublarde', niveau: 5 } })
    portail.modifierPersonnage({ ...qui('tom'), personnageId, champs: { pvMax: 33 } })
    expect(portail.personnage({ ...qui('lea'), personnageId })).toMatchObject({ fiche: { classe: 'Roublarde', niveau: 5, pvMax: 33 }, calculs: { maitrise: 3 } })
    expect(() => portail.modifierPersonnage({ ...qui('max'), personnageId, champs: { niveau: 1 } })).toThrow(refus('introuvable'))
    expect(() => portail.modifierPersonnage({ ...qui('lea'), personnageId, champs: { niveau: 42 } })).toThrow(refus('requete_invalide'))
  })

  it('se supprime par un MJ seulement : un joueur ne peut pas effacer ses Marques en recréant sa fiche', async () => {
    const { portail, qui, creer } = await table()
    const personnageId = creer('lea')
    expect(() => portail.supprimerPersonnage({ ...qui('max'), personnageId })).toThrow(refus('introuvable'))
    expect(() => portail.supprimerPersonnage({ ...qui('lea'), personnageId })).toThrow(refus('interdit'))
    portail.supprimerPersonnage({ ...qui('zoe'), personnageId })
    expect(portail.personnages(qui('lea')).personnageId).toBeNull()
  })
})

describe('bourse', () => {
  it('se change en rappelant ce qu’elle contenait : une prise faite entre-temps n’est jamais écrasée', async () => {
    const { portail, qui, creer } = await table()
    const personnageId = creer('lea')
    portail.changerBourse({ ...qui('lea'), personnageId, avant: bourse(), apres: bourse({ po: 15 }) })
    portail.changerBourse({ ...qui('tom'), personnageId, avant: bourse({ po: 15 }), apres: bourse({ po: 10, pa: 4 }) })
    expect(portail.personnage({ ...qui('lea'), personnageId }).bourse).toEqual(bourse({ po: 10, pa: 4 }))
    expect(() => portail.changerBourse({ ...qui('lea'), personnageId, avant: bourse({ po: 15 }), apres: bourse() })).toThrow(refus('conflit'))
    expect(() => portail.changerBourse({ ...qui('lea'), personnageId, avant: bourse({ po: 10, pa: 4 }), apres: bourse({ po: -1 }) })).toThrow(refus('requete_invalide'))
  })
})

describe('inventaire', () => {
  it('se remplit, se corrige et se vide par le joueur ou un MJ', async () => {
    const { portail, qui, creer } = await table()
    const personnageId = creer('lea')
    const { ligneId } = portail.ajouterLigne({ ...qui('lea'), personnageId, libelle: 'Corde (15 m)', quantite: 1, notes: '' })
    portail.modifierLigne({ ...qui('tom'), personnageId, ligneId, libelle: 'Corde de chanvre (15 m)', quantite: 2, notes: 'mouillée' })
    expect(portail.personnage({ ...qui('lea'), personnageId }).inventaire).toEqual([
      { id: ligneId, libelle: 'Corde de chanvre (15 m)', quantite: 2, notes: 'mouillée', objet: null },
    ])
    expect(() => portail.supprimerLigne({ ...qui('max'), personnageId, ligneId })).toThrow(refus('introuvable'))
    expect(() => portail.ajouterLigne({ ...qui('lea'), personnageId, libelle: '', quantite: 1, notes: '' })).toThrow(refus('requete_invalide'))
    portail.supprimerLigne({ ...qui('lea'), personnageId, ligneId })
    expect(portail.personnage({ ...qui('lea'), personnageId }).inventaire).toEqual([])
  })

  it("refuse de toucher la ligne d'un autre personnage par le sien", async () => {
    const { portail, qui, creer } = await table()
    const lea = creer('lea')
    const max = creer('max')
    const { ligneId } = portail.ajouterLigne({ ...qui('lea'), personnageId: lea, libelle: 'Dague', quantite: 1, notes: '' })
    expect(() => portail.supprimerLigne({ ...qui('max'), personnageId: max, ligneId })).toThrow(refus('introuvable'))
  })
})

describe('Marques du Rêve', () => {
  it('sont inscrites par un MJ, et le joueur est prévenu', async () => {
    const { portail, qui, creer } = await table()
    const personnageId = creer('lea')
    const { marqueId } = portail.ajouterMarque({ ...qui('tom'), personnageId, titre: 'Marque du Cœur', don: 'Voir dans le noir.', prix: 'Rêve de la mine.' })
    expect(portail.personnage({ ...qui('lea'), personnageId }).marques).toEqual([
      { id: marqueId, titre: 'Marque du Cœur', don: 'Voir dans le noir.', prix: 'Rêve de la mine.', creeLe: expect.any(String) },
    ])
    expect(portail.notifications({ demandeurId: qui('lea').demandeurId }).liste[0]).toMatchObject({
      texte: 'Une Marque du Rêve apparaît sur ta fiche : Marque du Cœur.', lien: `/campagne/${qui('lea').campagneId}/personnage`,
    })
    portail.modifierMarque({ ...qui('zoe'), personnageId, marqueId, titre: 'Marque du Cœur', don: 'Voir dans le noir (9 m).', prix: 'Rêve de la mine.' })
    expect(portail.personnage({ ...qui('lea'), personnageId }).marques[0].don).toBe('Voir dans le noir (9 m).')
  })

  it('ne sont ni écrites ni effacées par le joueur', async () => {
    const { portail, qui, creer } = await table()
    const personnageId = creer('lea')
    expect(() => portail.ajouterMarque({ ...qui('lea'), personnageId, titre: 'Fausse', don: '', prix: '' })).toThrow(refus('interdit'))
    const { marqueId } = portail.ajouterMarque({ ...qui('tom'), personnageId, titre: 'Vraie', don: '', prix: '' })
    expect(() => portail.supprimerMarque({ ...qui('lea'), personnageId, marqueId })).toThrow(refus('interdit'))
    portail.supprimerMarque({ ...qui('tom'), personnageId, marqueId })
    expect(portail.personnage({ ...qui('lea'), personnageId }).marques).toEqual([])
  })
})

describe('membres et données personnelles', () => {
  it('un joueur retiré de la campagne perd sa fiche', async () => {
    const { portail, qui, creer, ids, campagneId } = await table()
    const personnageId = creer('lea')
    portail.retirerMembre({ demandeurId: ids.tom, campagneId, cibleId: ids.lea })
    expect(() => portail.personnage({ ...qui('tom'), personnageId })).toThrow(refus('introuvable'))
  })

  it('la fiche, l’inventaire et les Marques sont dans l’export, et partent avec le compte', async () => {
    const { portail, qui, creer, ids } = await table()
    const personnageId = creer('lea', 'Isaure')
    portail.ajouterLigne({ ...qui('lea'), personnageId, libelle: 'Dague', quantite: 1, notes: '' })
    portail.ajouterMarque({ ...qui('tom'), personnageId, titre: 'Marque du Cœur', don: 'd', prix: 'p' })
    const { personnages } = portail.exporterDonnees(ids.lea)
    expect(personnages).toEqual([expect.objectContaining({
      campagne: 'Eldaria', fiche: expect.objectContaining({ nom: 'Isaure' }), bourse: bourse(),
      inventaire: [expect.objectContaining({ libelle: 'Dague' })], marques: [expect.objectContaining({ titre: 'Marque du Cœur' })],
    })])
    await portail.supprimerCompte({ utilisateurId: ids.lea, motDePasse: MDP })
    expect(portail.personnages(qui('tom')).personnages).toEqual([])
  })
})
