import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, inscrire, portailDeTest } from './aides.js'

// Horloge des tests : lundi 5 octobre 2026, 22 h à Paris.
const DATES = ['2026-10-10', '2026-10-17', '2026-10-24']

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = {}
  for (const [identifiant, role] of [['co-mj', 'mj'], ['lea', 'joueur'], ['max', 'joueur'], ['sam', 'joueur'], ['ocre', 'occasionnel']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  const ouvrir = (options = {}) => portail.ouvrirSondage({ demandeurId: tomId, campagneId, dates: DATES, lieu: 'Chez Tom', ...options })
  const voir = (demandeurId) => portail.planning({ demandeurId, campagneId })
  return { ...outils, campagneId, tomId, ids, ouvrir, voir }
}

const dateDu = (planning, jour) => planning.sondage.dates.find((d) => d.jour === jour)

describe('un MJ ouvre un sondage de dates', () => {
  it('propose plusieurs dates, visibles des MJ et des joueurs', async () => {
    const { ouvrir, voir, tomId, ids } = await table()
    ouvrir({ dateLimite: '2026-10-08' })
    for (const qui of [tomId, ids['co-mj'], ids.lea]) {
      const { sondage } = voir(qui)
      expect(sondage.dates.map((d) => d.jour)).toEqual(DATES)
      expect(sondage).toMatchObject({ lieu: 'Chez Tom', dateLimite: '2026-10-08', ouvertAuxReponses: true })
      expect(sondage.joueurs.map((j) => j.identifiant)).toEqual(['lea', 'max', 'sam'])
    }
  })

  it("n'est pas montré aux joueurs occasionnels", async () => {
    const { ouvrir, voir, ids } = await table()
    ouvrir()
    expect(voir(ids.ocre).sondage).toBeNull()
  })

  it("est réservé aux MJ", async () => {
    const { portail, campagneId, ids } = await table()
    expect(() => portail.ouvrirSondage({ demandeurId: ids.lea, campagneId, dates: DATES })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })

  it('refuse des dates invalides, passées, en double, trop nombreuses ou absentes', async () => {
    const { ouvrir } = await table()
    for (const dates of [[], ['2026-10-04'], ['2026-13-01'], ['2026-10-10', '2026-10-10'], Array.from({ length: 11 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)]) {
      expect(() => ouvrir({ dates })).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
    }
  })

  it("n'autorise qu'un sondage ouvert à la fois", async () => {
    const { ouvrir } = await table()
    ouvrir()
    expect(() => ouvrir()).toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it('prévient les joueurs, et eux seuls', async () => {
    const { portail, ouvrir, tomId, ids } = await table()
    ouvrir()
    expect(portail.notifications({ demandeurId: ids.lea }).liste[0]).toMatchObject({ texte: 'Nouveau sondage : 3 dates proposées pour la prochaine séance.', lien: '/campagne/1/seances', lue: false })
    expect(portail.notifications({ demandeurId: ids.ocre }).liste).toEqual([])
    expect(portail.notifications({ demandeurId: tomId }).liste).toEqual([])
  })
})

describe('les joueurs répondent', () => {
  it('oui avec une plage horaire, ou non', async () => {
    const { portail, campagneId, ouvrir, voir, ids } = await table()
    const { sondageId } = ouvrir()
    const [d1, d2] = voir(ids.lea).sondage.dates
    portail.repondre({ demandeurId: ids.lea, campagneId, sondageId, reponses: [
      { dateId: d1.id, disponible: true, debut: '14:00', fin: '23:00' },
      { dateId: d2.id, disponible: false },
    ] })
    const vu = voir(ids.max).sondage
    expect(dateDu({ sondage: vu }, DATES[0]).reponses).toEqual([{ utilisateurId: ids.lea, identifiant: 'lea', disponible: true, debut: 840, fin: 1380 }])
    expect(dateDu({ sondage: vu }, DATES[1]).reponses).toEqual([{ utilisateurId: ids.lea, identifiant: 'lea', disponible: false, debut: null, fin: null }])
  })

  it('exige une plage horaire valide pour un oui', async () => {
    const { portail, campagneId, ouvrir, voir, ids } = await table()
    const { sondageId } = ouvrir()
    const [d1] = voir(ids.lea).sondage.dates
    expect(() => portail.repondre({ demandeurId: ids.lea, campagneId, sondageId, reponses: [{ dateId: d1.id, disponible: true }] }))
      .toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it('peut changer sa réponse', async () => {
    const { portail, campagneId, ouvrir, voir, ids } = await table()
    const { sondageId } = ouvrir()
    const [d1] = voir(ids.lea).sondage.dates
    const repondre = (reponse) => portail.repondre({ demandeurId: ids.lea, campagneId, sondageId, reponses: [{ dateId: d1.id, ...reponse }] })
    repondre({ disponible: true, debut: '14:00', fin: '18:00' })
    repondre({ disponible: false })
    expect(voir(ids.lea).sondage.dates[0].reponses).toEqual([expect.objectContaining({ disponible: false })])
  })

  it("est réservé aux joueurs : ni MJ, ni occasionnels", async () => {
    const { portail, campagneId, ouvrir, voir, tomId, ids } = await table()
    const { sondageId } = ouvrir()
    const [d1] = voir(ids.lea).sondage.dates
    for (const qui of [tomId, ids['co-mj'], ids.ocre]) {
      expect(() => portail.repondre({ demandeurId: qui, campagneId, sondageId, reponses: [{ dateId: d1.id, disponible: false }] }))
        .toThrow(expect.objectContaining({ code: 'interdit' }))
    }
  })

  it("refuse une date qui n'appartient pas au sondage", async () => {
    const { portail, campagneId, ouvrir, ids } = await table()
    const { sondageId } = ouvrir()
    expect(() => portail.repondre({ demandeurId: ids.lea, campagneId, sondageId, reponses: [{ dateId: 9999, disponible: false }] }))
      .toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })

  it('ferme les réponses après la date limite (incluse)', async () => {
    const { portail, campagneId, ouvrir, voir, ids, avancer } = await table()
    const { sondageId } = ouvrir({ dateLimite: '2026-10-06' })
    const [d1] = voir(ids.lea).sondage.dates
    avancer(1) // mardi 6, 22 h : encore possible
    portail.repondre({ demandeurId: ids.lea, campagneId, sondageId, reponses: [{ dateId: d1.id, disponible: false }] })
    avancer(1) // mercredi 7
    expect(voir(ids.lea).sondage.ouvertAuxReponses).toBe(false)
    expect(() => portail.repondre({ demandeurId: ids.lea, campagneId, sondageId, reponses: [{ dateId: d1.id, disponible: false }] }))
      .toThrow(expect.objectContaining({ code: 'requete_invalide' }))
  })
})

describe('un joueur retiré de la campagne', () => {
  it("disparaît des réponses et du calcul, et perd les notifications de la campagne", async () => {
    const { portail, campagneId, ouvrir, voir, tomId, ids } = await table()
    const { sondageId } = ouvrir()
    const [d1] = voir(tomId).sondage.dates
    portail.repondre({ demandeurId: ids.lea, campagneId, sondageId, reponses: [{ dateId: d1.id, disponible: true, debut: '14:00', fin: '18:00' }] })
    portail.retirerMembre({ demandeurId: tomId, campagneId, cibleId: ids.lea })
    const date = voir(tomId).sondage.dates[0]
    expect(date).toMatchObject({ reponses: [], disponibles: 0, creneau: null })
    expect(voir(tomId).sondage.meilleureDateId).toBeNull()
    expect(portail.notifications({ demandeurId: ids.lea }).liste).toEqual([])
  })
})

describe('la synthèse aide le MJ à choisir', () => {
  it('compte les disponibles, calcule le créneau commun et désigne la meilleure date', async () => {
    const { portail, campagneId, ouvrir, voir, tomId, ids } = await table()
    const { sondageId } = ouvrir()
    const [d1, d2, d3] = voir(tomId).sondage.dates
    const repond = (qui, reponses) => portail.repondre({ demandeurId: ids[qui], campagneId, sondageId, reponses })
    repond('lea', [{ dateId: d1.id, disponible: true, debut: '14:00', fin: '23:00' }, { dateId: d2.id, disponible: true, debut: '10:00', fin: '18:00' }, { dateId: d3.id, disponible: false }])
    repond('max', [{ dateId: d1.id, disponible: true, debut: '16:00', fin: '01:00' }, { dateId: d2.id, disponible: true, debut: '13:00', fin: '22:00' }])
    repond('sam', [{ dateId: d1.id, disponible: false }, { dateId: d2.id, disponible: true, debut: '09:00', fin: '17:00' }])

    const { sondage } = voir(tomId)
    expect(dateDu({ sondage }, DATES[0])).toMatchObject({ disponibles: 2, creneau: { debut: 960, fin: 1380 } })
    expect(dateDu({ sondage }, DATES[1])).toMatchObject({ disponibles: 3, creneau: { debut: 780, fin: 1020 } })
    expect(dateDu({ sondage }, DATES[2])).toMatchObject({ disponibles: 0, creneau: null })
    expect(sondage.meilleureDateId).toBe(d2.id)
  })
})

describe('un MJ fixe la séance', () => {
  it('crée la séance, ferme le sondage et prévient tous les autres membres', async () => {
    const { portail, campagneId, ouvrir, voir, tomId, ids } = await table()
    const { sondageId } = ouvrir()
    const d2 = voir(tomId).sondage.dates[1]
    portail.fixerSeance({ demandeurId: ids['co-mj'], campagneId, sondageId, dateId: d2.id, debut: '14:00', fin: '23:00' })

    for (const qui of [tomId, ids.lea, ids.ocre]) {
      expect(voir(qui)).toMatchObject({ sondage: null, prochaineSeance: { jour: '2026-10-17', debut: 840, fin: 1380, lieu: 'Chez Tom' } })
    }
    const texte = 'Séance fixée : samedi 17 octobre 2026, de 14 h à 23 h.'
    expect(portail.notifications({ demandeurId: ids.ocre }).liste[0].texte).toBe(texte)
    expect(portail.notifications({ demandeurId: tomId }).liste[0].texte).toBe(texte)
    expect(portail.notifications({ demandeurId: ids['co-mj'] }).liste).toEqual([])
  })

  it('peut remplacer le lieu du sondage', async () => {
    const { portail, campagneId, ouvrir, voir, tomId } = await table()
    const { sondageId } = ouvrir()
    const d1 = voir(tomId).sondage.dates[0]
    portail.fixerSeance({ demandeurId: tomId, campagneId, sondageId, dateId: d1.id, debut: '20:00', fin: '01:00', lieu: 'Chez Léa' })
    expect(voir(tomId).prochaineSeance).toMatchObject({ lieu: 'Chez Léa', debut: 1200, fin: 1500 })
  })

  it('garde le lieu du sondage quand aucun lieu (ou null) n’est donné', async () => {
    const { portail, campagneId, ouvrir, voir, tomId } = await table()
    const { sondageId } = ouvrir()
    portail.fixerSeance({ demandeurId: tomId, campagneId, sondageId, dateId: voir(tomId).sondage.dates[0].id, debut: '14:00', fin: '18:00', lieu: null })
    expect(voir(tomId).prochaineSeance.lieu).toBe('Chez Tom')
  })

  it('est réservé aux MJ', async () => {
    const { portail, campagneId, ouvrir, voir, ids } = await table()
    const { sondageId } = ouvrir()
    const d1 = voir(ids.lea).sondage.dates[0]
    expect(() => portail.fixerSeance({ demandeurId: ids.lea, campagneId, sondageId, dateId: d1.id, debut: '14:00', fin: '18:00' }))
      .toThrow(expect.objectContaining({ code: 'interdit' }))
  })

  it('permet ensuite d’ouvrir un nouveau sondage', async () => {
    const { portail, campagneId, ouvrir, voir, tomId } = await table()
    const { sondageId } = ouvrir()
    portail.fixerSeance({ demandeurId: tomId, campagneId, sondageId, dateId: voir(tomId).sondage.dates[0].id, debut: '14:00', fin: '18:00' })
    expect(() => ouvrir({ dates: ['2026-11-07'] })).not.toThrow()
  })
})

describe('annulations', () => {
  it("un MJ annule le sondage : les joueurs sont prévenus", async () => {
    const { portail, campagneId, ouvrir, voir, tomId, ids } = await table()
    const { sondageId } = ouvrir()
    portail.annulerSondage({ demandeurId: tomId, campagneId, sondageId })
    expect(voir(ids.lea).sondage).toBeNull()
    expect(portail.notifications({ demandeurId: ids.lea }).liste[0].texte).toBe('Le sondage de dates a été annulé.')
  })

  it('un MJ annule une séance fixée : tous les autres membres sont prévenus', async () => {
    const { portail, campagneId, ouvrir, voir, tomId, ids } = await table()
    const { sondageId } = ouvrir()
    portail.fixerSeance({ demandeurId: tomId, campagneId, sondageId, dateId: voir(tomId).sondage.dates[0].id, debut: '14:00', fin: '18:00' })
    const { id } = voir(tomId).prochaineSeance
    portail.annulerSeance({ demandeurId: tomId, campagneId, seanceId: id })
    expect(voir(ids.ocre).prochaineSeance).toBeNull()
    expect(portail.notifications({ demandeurId: ids.ocre }).liste[0].texte).toBe('Séance annulée : samedi 10 octobre 2026, de 14 h à 18 h.')
  })

  it('les joueurs ne peuvent rien annuler', async () => {
    const { portail, campagneId, ouvrir, ids } = await table()
    const { sondageId } = ouvrir()
    expect(() => portail.annulerSondage({ demandeurId: ids.lea, campagneId, sondageId })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })
})

describe('prochaine séance', () => {
  it('disparaît une fois le jour passé', async () => {
    const { portail, campagneId, ouvrir, voir, tomId, avancer } = await table()
    const { sondageId } = ouvrir()
    portail.fixerSeance({ demandeurId: tomId, campagneId, sondageId, dateId: voir(tomId).sondage.dates[0].id, debut: '14:00', fin: '18:00' })
    avancer(5) // samedi 10 à 22 h : c'est le jour même
    expect(voir(tomId).prochaineSeance).not.toBeNull()
    avancer(1)
    expect(voir(tomId).prochaineSeance).toBeNull()
  })

  it("n'est visible que des membres de la campagne", async () => {
    const { portail, campagneId } = await table()
    const autre = portail.initialiserCampagne({ nom: 'Autre' })
    const { utilisateurId } = await portail.accepterInvitation(autre.jeton, { identifiant: 'etranger', motDePasse: 'une phrase de passe solide' })
    expect(() => portail.planning({ demandeurId: utilisateurId, campagneId })).toThrow(expect.objectContaining({ code: 'interdit' }))
  })
})

describe('notifications', () => {
  it('se marquent comme lues', async () => {
    const { portail, ouvrir, ids } = await table()
    ouvrir()
    expect(portail.notifications({ demandeurId: ids.lea }).nonLues).toBe(1)
    portail.marquerNotificationsLues({ demandeurId: ids.lea })
    expect(portail.notifications({ demandeurId: ids.lea })).toMatchObject({ nonLues: 0, liste: [expect.objectContaining({ lue: true })] })
  })
})

describe('conservation limitée (RGPD)', () => {
  it('efface les réponses 30 jours après la dernière date proposée, et les notifications lues après 30 jours', async () => {
    const { db, portail, campagneId, ouvrir, voir, tomId, ids, avancer } = await table()
    const { sondageId } = ouvrir()
    const [d1] = voir(tomId).sondage.dates
    portail.repondre({ demandeurId: ids.lea, campagneId, sondageId, reponses: [{ dateId: d1.id, disponible: false }] })
    portail.marquerNotificationsLues({ demandeurId: ids.lea })
    const compter = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n

    avancer(30)
    portail.purger()
    expect([compter('sondages'), compter('disponibilites')]).toEqual([1, 1])
    expect(compter('notifications')).toBe(3) // lue il y a 30 jours pile : pas encore effacée

    avancer(20) // 24 octobre + 30 jours dépassé
    portail.purger()
    expect([compter('sondages'), compter('sondage_dates'), compter('disponibilites')]).toEqual([0, 0, 0])
    expect(portail.notifications({ demandeurId: ids.lea }).liste).toEqual([])
  })

  it('efface même les notifications non lues au bout de 90 jours', async () => {
    const { db, portail, ouvrir, avancer } = await table()
    ouvrir()
    avancer(91)
    portail.purger()
    expect(db.prepare('SELECT COUNT(*) AS n FROM notifications').get().n).toBe(0)
  })
})

describe("l'export RGPD inclut la planification", () => {
  it('contient les disponibilités données et les notifications reçues', async () => {
    const { portail, campagneId, ouvrir, voir, ids } = await table()
    const { sondageId } = ouvrir()
    const [d1] = voir(ids.lea).sondage.dates
    portail.repondre({ demandeurId: ids.lea, campagneId, sondageId, reponses: [{ dateId: d1.id, disponible: true, debut: '14:00', fin: '18:00' }] })
    const exportation = portail.exporterDonnees(ids.lea)
    expect(exportation.disponibilites).toEqual([{ campagne: 'Eldaria', jour: '2026-10-10', disponible: true, debut: '14:00', fin: '18:00', reponduLe: '2026-10-05T20:00:00.000Z' }])
    expect(exportation.notifications).toEqual([expect.objectContaining({ texte: 'Nouveau sondage : 3 dates proposées pour la prochaine séance.', lue: false })])
  })
})

