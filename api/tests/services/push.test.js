import { createECDH, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ouvrirBase } from '../../src/infra/base.js'
import { creerStockageMemoire } from '../../src/infra/stockageImages.js'
import { creerPortail } from '../../src/services/portail.js'
import { campagneAvecProprietaire, inscrire, portailDeTest } from './aides.js'

const refus = (code) => expect.objectContaining({ code })

/** Un abonnement comme en fournit un navigateur. */
function abonnement(adresse = `https://fcm.googleapis.com/fcm/send/${randomBytes(8).toString('hex')}`) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { endpoint: adresse, keys: { p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') } }
}

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = { tom: tomId }
  for (const [identifiant, role] of [['lea', 'joueur'], ['max', 'joueur']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  const qui = (nom) => ({ demandeurId: ids[nom], campagneId })
  const annonce = (texte, destinataires = 'tous') => portail.envoyerAnnonce({ ...qui('tom'), texte, destinataires })
  return { ...outils, campagneId, ids, qui, annonce }
}

describe('notifications push : clés du serveur', () => {
  it('sont créées une fois, puis toujours les mêmes', async () => {
    const { portail } = await table()
    const cle = portail.clePubliquePush()
    expect(cle).toMatch(/^[A-Za-z0-9_-]{87}$/)
    expect(portail.clePubliquePush()).toBe(cle)
  })
})

describe('notifications push : appareils', () => {
  it('un appareil abonné reçoit les notifications de son compte, et seulement elles', async () => {
    const { portail, ids, annonce, pushs } = await table()
    const telephone = abonnement()
    portail.abonnerAppareil({ utilisateurId: ids.lea, abonnement: telephone, appareil: 'Android' })
    annonce('Séance avancée à 13 h.', [ids.lea])
    annonce('Pensez aux dés.', [ids.max])
    expect(await portail.envoyerPushEnAttente()).toMatchObject({ envoyes: 1 })
    expect(pushs).toEqual([{ adresse: telephone.endpoint, charge: { titre: 'Eldaria', texte: 'Message de tom : Séance avancée à 13 h.', lien: expect.stringMatching(/^\/campagne\/\d+$/) } }])
    // Déjà envoyée : elle ne repart pas.
    expect(await portail.envoyerPushEnAttente()).toMatchObject({ envoyes: 0 })
  })

  it("refuse une adresse qui n'est pas celle d'un service push de navigateur", async () => {
    const { portail, ids } = await table()
    for (const adresse of ['https://169.254.169.254/latest/meta-data', 'http://fcm.googleapis.com/x', 'https://exemple.fr/push']) {
      expect(() => portail.abonnerAppareil({ utilisateurId: ids.lea, abonnement: abonnement(adresse), appareil: '' })).toThrow(refus('requete_invalide'))
    }
    expect(() => portail.abonnerAppareil({ utilisateurId: ids.lea, abonnement: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'court', auth: 'x' } }, appareil: '' }))
      .toThrow(refus('requete_invalide'))
  })

  it("un même navigateur réabonné passe au dernier compte connecté, sans doublon", async () => {
    const { portail, ids } = await table()
    const navigateur = abonnement()
    portail.abonnerAppareil({ utilisateurId: ids.lea, abonnement: navigateur, appareil: 'PC' })
    portail.abonnerAppareil({ utilisateurId: ids.lea, abonnement: navigateur, appareil: 'PC' })
    expect(portail.appareilsPush({ utilisateurId: ids.lea })).toHaveLength(1)
    portail.abonnerAppareil({ utilisateurId: ids.max, abonnement: navigateur, appareil: 'PC' })
    expect(portail.appareilsPush({ utilisateurId: ids.lea })).toEqual([])
    expect(portail.appareilsPush({ utilisateurId: ids.max })).toHaveLength(1)
  })

  it("oublie un appareil que le service push déclare disparu (404 ou 410)", async () => {
    const { portail, ids, annonce, reponsesPush } = await table()
    const ancien = abonnement()
    portail.abonnerAppareil({ utilisateurId: ids.lea, abonnement: ancien, appareil: '' })
    reponsesPush.set(ancien.endpoint, 410)
    annonce('Coucou', [ids.lea])
    await portail.envoyerPushEnAttente()
    expect(portail.appareilsPush({ utilisateurId: ids.lea })).toEqual([])
  })

  it('dit à un navigateur si le serveur le connaît encore pour ce compte', async () => {
    const { portail, ids } = await table()
    const navigateur = abonnement()
    portail.abonnerAppareil({ utilisateurId: ids.lea, abonnement: navigateur, appareil: '' })
    expect(portail.appareilAbonne({ utilisateurId: ids.lea, adresse: navigateur.endpoint })).toBe(true)
    expect(portail.appareilAbonne({ utilisateurId: ids.max, adresse: navigateur.endpoint })).toBe(false)
  })

  it('un service push qui ne répond pas ne bloque pas les autres envois', async () => {
    const recus = []
    const muet = abonnement('https://web.push.apple.com/muet')
    const envoyeurPush = ({ abonnement: a }) => (a.endpoint === muet.endpoint ? new Promise(() => {}) : (recus.push(a.endpoint), Promise.resolve({ statut: 201 })))
    const portail = creerPortail({ db: ouvrirBase(':memory:'), coutMotDePasse: { N: 1024 }, images: creerStockageMemoire(), envoyeurPush, delaiEnvoiPushMs: 50 })
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const lea = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant: 'lea', role: 'joueur' })
    const bavard = abonnement()
    portail.abonnerAppareil({ utilisateurId: lea, abonnement: muet, appareil: '' })
    portail.abonnerAppareil({ utilisateurId: lea, abonnement: bavard, appareil: '' })
    portail.envoyerAnnonce({ demandeurId: tomId, campagneId, texte: 'Coucou', destinataires: [lea] })
    expect(await portail.envoyerPushEnAttente()).toEqual({ envoyes: 1, echecs: 1 })
    expect(recus).toEqual([bavard.endpoint])
  })

  it("se désabonne, et chacun ne retire que ses propres appareils", async () => {
    const { portail, ids } = await table()
    portail.abonnerAppareil({ utilisateurId: ids.lea, abonnement: abonnement(), appareil: 'Téléphone' })
    const [appareil] = portail.appareilsPush({ utilisateurId: ids.lea })
    expect(appareil).toMatchObject({ appareil: 'Téléphone' })
    expect(appareil).not.toHaveProperty('adresse')
    expect(() => portail.retirerAppareil({ utilisateurId: ids.max, appareilId: appareil.id })).toThrow(refus('introuvable'))
    portail.retirerAppareil({ utilisateurId: ids.lea, appareilId: appareil.id })
    expect(portail.appareilsPush({ utilisateurId: ids.lea })).toEqual([])
  })
})

describe('notifications push : les choix de chacun', () => {
  it('tout est reçu par défaut ; une catégorie coupée ne part plus sur les appareils, mais reste sous la cloche', async () => {
    const { portail, ids, annonce, pushs } = await table()
    expect(portail.preferencesPush({ utilisateurId: ids.lea }).every((c) => c.actif)).toBe(true)
    portail.abonnerAppareil({ utilisateurId: ids.lea, abonnement: abonnement(), appareil: '' })
    portail.changerPreferencesPush({ utilisateurId: ids.lea, actives: ['seances', 'revelations', 'personnage', 'carte'] })
    expect(portail.preferencesPush({ utilisateurId: ids.lea }).find((c) => c.cle === 'annonces').actif).toBe(false)
    annonce('Silence', [ids.lea])
    await portail.envoyerPushEnAttente()
    expect(pushs).toEqual([])
    expect(portail.notifications({ demandeurId: ids.lea }).liste[0].texte).toBe('Message de tom : Silence')
  })

  it('refuse une catégorie inconnue', async () => {
    const { portail, ids } = await table()
    expect(() => portail.changerPreferencesPush({ utilisateurId: ids.lea, actives: ['spam'] })).toThrow(refus('requete_invalide'))
    expect(() => portail.changerPreferencesPush({ utilisateurId: ids.lea, actives: 'seances' })).toThrow(refus('requete_invalide'))
  })

  it("figurent dans l'export, avec les appareils (sans leurs clés)", async () => {
    const { portail, ids } = await table()
    portail.abonnerAppareil({ utilisateurId: ids.lea, abonnement: abonnement(), appareil: 'Android' })
    portail.changerPreferencesPush({ utilisateurId: ids.lea, actives: ['seances'] })
    const { notificationsPush } = portail.exporterDonnees(ids.lea)
    expect(notificationsPush.appareils).toEqual([{ appareil: 'Android', service: 'fcm.googleapis.com', creeLe: expect.any(String), dernierEnvoiLe: null }])
    expect(notificationsPush.categoriesCoupees).toEqual(['revelations', 'personnage', 'annonces', 'carte'])
  })
})

describe('annonces du MJ', () => {
  it('partent au groupe ou à certains joueurs, signées', async () => {
    const { portail, ids, annonce } = await table()
    annonce('On joue chez Léa samedi.')
    expect(portail.notifications({ demandeurId: ids.max }).liste[0].texte).toBe('Message de tom : On joue chez Léa samedi.')
    expect(portail.notifications({ demandeurId: ids.tom }).liste).toEqual([])
    annonce('Rien que pour toi.', [ids.lea])
    expect(portail.notifications({ demandeurId: ids.max }).liste).toHaveLength(1)
  })

  it('ne viennent que des MJ, ne sont jamais vides, et ne visent que des membres', async () => {
    const { portail, qui, annonce, ids } = await table()
    expect(() => portail.envoyerAnnonce({ ...qui('lea'), texte: 'x', destinataires: 'tous' })).toThrow(refus('interdit'))
    expect(() => annonce(' ')).toThrow(refus('requete_invalide'))
    expect(() => annonce('x'.repeat(501))).toThrow(refus('requete_invalide'))
    expect(() => annonce('x', [9999])).toThrow(refus('requete_invalide'))
    expect(() => annonce('x', [])).toThrow(refus('requete_invalide'))
    expect(() => annonce('x', [ids.tom])).not.toThrow()
  })
})
