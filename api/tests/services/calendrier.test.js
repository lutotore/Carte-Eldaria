import { describe, expect, it } from 'vitest'
import { DATE_DE_DEPART, depuisDate, formater } from '../../../src/domain/calendrier.js'
import { campagneAvecProprietaire, etatExemple, inscrire, MDP, portailDeTest } from './aides.js'

const refus = (code) => expect.objectContaining({ code })
const jourDe = (annee, mois, jour) => depuisDate({ annee, mois, jour })

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = { tom: tomId }
  for (const [identifiant, role] of [['lea', 'joueur'], ['max', 'joueur'], ['zoe', 'mj']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  portail.importerEtat(campagneId, etatExemple())
  const qui = (nom) => ({ demandeurId: ids[nom], campagneId })
  const vue = (nom) => portail.calendrier(qui(nom))
  const titres = (nom) => vue(nom).evenements.map((e) => e.titre)
  const evenement = (nom, e) => portail.creerEvenement({ ...qui(nom), duree: 1, annuel: false, description: '', ...e }).evenementId
  return { ...outils, campagneId, ids, qui, vue, titres, evenement }
}

describe('calendrier : la date du jour', () => {
  it('commence au 3 Longue-Vue 3207, avec les fêtes connues de tous', async () => {
    const { vue } = await table()
    const calendrier = vue('lea')
    expect(calendrier.aujourdhui).toBe(DATE_DE_DEPART)
    expect(calendrier.evenements.filter((e) => e.type === 'fete').map((e) => e.titre)).toContain('Nuit des Lanternes')
  })

  it('n’avance que par un MJ, et s’affiche sur la carte', async () => {
    const { portail, qui, vue } = await table()
    portail.changerDate({ ...qui('zoe'), jour: DATE_DE_DEPART + 3 })
    expect(vue('lea').aujourdhui).toBe(DATE_DE_DEPART + 3)
    expect(portail.lireMonde(qui('lea')).date).toEqual({ jour: DATE_DE_DEPART + 3, texte: '6 Longue-Vue 3207 AE', souffle: 'Le Creux' })
    expect(() => portail.changerDate({ ...qui('lea'), jour: 0 })).toThrow(refus('interdit'))
    expect(() => portail.changerDate({ ...qui('tom'), jour: -4 })).toThrow(refus('requete_invalide'))
    // Au-delà, la base ne saurait plus relire la date : tout le calendrier tomberait.
    expect(() => portail.changerDate({ ...qui('tom'), jour: 1e17 })).toThrow(refus('requete_invalide'))
  })
})

describe('calendrier : la date butoir', () => {
  it('reste un secret du MJ, avec son compte à rebours, jusqu’à ce qu’il la révèle', async () => {
    const { portail, qui, vue, ids } = await table()
    const fin = jourDe(3209, 2, 12)
    portail.changerButoir({ ...qui('tom'), jour: fin, libelle: 'Le Grand Éveil', revele: false })
    expect(vue('tom').butoir).toEqual({ jour: fin, libelle: 'Le Grand Éveil', revele: false, joursRestants: fin - DATE_DE_DEPART })
    expect(vue('lea').butoir).toBeNull()
    portail.changerButoir({ ...qui('tom'), jour: fin, libelle: 'Le Grand Éveil', revele: true })
    expect(vue('lea').butoir).toEqual({ jour: fin, libelle: 'Le Grand Éveil', joursRestants: fin - DATE_DE_DEPART })
    expect(portail.notifications({ demandeurId: ids.lea }).liste[0].texte).toBe(`Le Grand Éveil : ${formater(fin)}.`)
    portail.changerButoir({ ...qui('tom'), jour: null, libelle: 'Le Grand Éveil', revele: true })
    expect(vue('lea').butoir).toBeNull()
  })

  it('ne se règle que par un MJ', async () => {
    const { portail, qui } = await table()
    expect(() => portail.changerButoir({ ...qui('lea'), jour: 5, libelle: 'x', revele: true })).toThrow(refus('interdit'))
    expect(() => portail.changerButoir({ ...qui('tom'), jour: 5, libelle: '', revele: true })).toThrow(refus('requete_invalide'))
  })
})

describe('calendrier : événements du MJ', () => {
  it('cachés, ils ne sont vus que des MJ ; révélés, les joueurs sont prévenus', async () => {
    const { portail, qui, titres, evenement, ids } = await table()
    const chute = evenement('tom', { type: 'evenement', jour: jourDe(3207, 11, 20), titre: 'Cendrebas tombe', visibilite: 'cache' })
    expect(titres('zoe')).toContain('Cendrebas tombe')
    expect(titres('lea')).not.toContain('Cendrebas tombe')
    portail.modifierEvenement({ ...qui('tom'), evenementId: chute, type: 'evenement', jour: jourDe(3207, 11, 20), duree: 1, annuel: false, titre: 'Cendrebas tombe', description: '', visibilite: 'groupe' })
    expect(titres('lea')).toContain('Cendrebas tombe')
    expect(portail.notifications({ demandeurId: ids.max }).liste[0]).toMatchObject({ texte: 'Calendrier : Cendrebas tombe, le 20 Veillée 3207 AE.' })
  })

  it('la chronique date chaque séance dans le monde', async () => {
    const { vue, evenement } = await table()
    evenement('tom', { type: 'chronique', jour: DATE_DE_DEPART, duree: 3, titre: 'Séance 1 : L’Erreur de Mesure', description: 'Recrutement.', visibilite: 'groupe' })
    expect(vue('lea').evenements.find((e) => e.type === 'chronique')).toMatchObject({ jour: DATE_DE_DEPART, duree: 3, description: 'Recrutement.' })
  })

  it('ne sont créés, modifiés ou supprimés que par un MJ', async () => {
    const { portail, qui, evenement } = await table()
    expect(() => evenement('lea', { type: 'evenement', jour: 10, titre: 'x', visibilite: 'groupe' })).toThrow(refus('interdit'))
    const id = evenement('tom', { type: 'evenement', jour: 10, titre: 'x', visibilite: 'cache' })
    expect(() => portail.supprimerEvenement({ ...qui('lea'), evenementId: id })).toThrow(refus('introuvable'))
    portail.supprimerEvenement({ ...qui('zoe'), evenementId: id })
  })

  it('refusent un type, une visibilité ou une date invalide', async () => {
    const { evenement } = await table()
    expect(() => evenement('tom', { type: 'anniversaire', jour: 10, titre: 'x', visibilite: 'cache' })).toThrow(refus('requete_invalide'))
    expect(() => evenement('tom', { type: 'evenement', jour: 10, titre: 'x', visibilite: 'privee' })).toThrow(refus('requete_invalide'))
    expect(() => evenement('tom', { type: 'evenement', jour: -1, titre: 'x', visibilite: 'cache' })).toThrow(refus('requete_invalide'))
    expect(() => evenement('lea', { type: 'note', jour: 1e17, titre: 'x', visibilite: 'privee' })).toThrow(refus('requete_invalide'))
  })
})

describe('calendrier : notes des joueurs', () => {
  it('privées, elles ne sont lues que par leur auteur et les MJ ; partagées, par tout le groupe', async () => {
    const { titres, evenement } = await table()
    evenement('lea', { type: 'note', jour: DATE_DE_DEPART + 2, titre: 'Rendez-vous avec Pip', visibilite: 'privee' })
    evenement('lea', { type: 'note', jour: DATE_DE_DEPART + 5, titre: 'Départ pour Cendrebas', visibilite: 'groupe' })
    expect(titres('lea')).toEqual(expect.arrayContaining(['Rendez-vous avec Pip', 'Départ pour Cendrebas']))
    expect(titres('tom')).toEqual(expect.arrayContaining(['Rendez-vous avec Pip', 'Départ pour Cendrebas']))
    expect(titres('max')).toContain('Départ pour Cendrebas')
    expect(titres('max')).not.toContain('Rendez-vous avec Pip')
  })

  it('ne se modifient que par leur auteur', async () => {
    const { portail, qui, evenement, vue } = await table()
    const id = evenement('lea', { type: 'note', jour: 10, titre: 'Pip', visibilite: 'groupe' })
    const modif = { evenementId: id, type: 'note', jour: 10, duree: 1, annuel: false, titre: 'Pip ment', description: '', visibilite: 'groupe' }
    expect(() => portail.modifierEvenement({ ...qui('max'), ...modif })).toThrow(refus('introuvable'))
    expect(() => portail.modifierEvenement({ ...qui('tom'), ...modif })).toThrow(refus('introuvable'))
    portail.modifierEvenement({ ...qui('lea'), ...modif })
    expect(vue('max').evenements.find((e) => e.id === id)).toMatchObject({ titre: 'Pip ment', auteur: 'lea', mienne: false })
    expect(() => portail.modifierEvenement({ ...qui('lea'), ...modif, visibilite: 'cache' })).toThrow(refus('requete_invalide'))
  })

  it('suivent les règles de données personnelles : export, départ de la campagne, suppression du compte', async () => {
    const { portail, evenement, ids, campagneId, titres } = await table()
    evenement('lea', { type: 'note', jour: 10, titre: 'Pip', visibilite: 'groupe' })
    expect(portail.exporterDonnees(ids.lea).calendrier).toEqual([
      { campagne: 'Eldaria', date: formater(10), titre: 'Pip', description: '', visibilite: 'groupe', creeLe: expect.any(String) },
    ])
    evenement('max', { type: 'note', jour: 11, titre: 'Bram', visibilite: 'groupe' })
    portail.retirerMembre({ demandeurId: ids.tom, campagneId, cibleId: ids.lea })
    expect(titres('tom')).not.toContain('Pip')
    await portail.supprimerCompte({ utilisateurId: ids.max, motDePasse: MDP })
    expect(titres('tom')).not.toContain('Bram')
  })
})
