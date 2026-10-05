import { describe, expect, it } from 'vitest'
import {
  CATEGORIES, estAdressePushAutorisee, nouveautesDuMonde, rappelsDus, relanceDue, texteRappel,
} from '../../src/domain/notifications.js'

describe('catégories de notifications', () => {
  it('chacune a un nom lisible, pour les réglages de chaque joueur', () => {
    expect(CATEGORIES.map((c) => c.cle)).toEqual(['seances', 'revelations', 'personnage', 'annonces', 'carte'])
    expect(CATEGORIES.every((c) => c.nom && c.description)).toBe(true)
  })
})

describe('rappels de séance', () => {
  // Samedi 17 octobre 2026 de 14 h à 20 h, heure de Paris (UTC+2 en octobre).
  const seance = { id: 4, jour: '2026-10-17', debut: 14 * 60, fin: 20 * 60, lieu: 'Chez Tom' }
  const a = (iso) => new Date(iso)

  it('la veille à 18 h, puis deux heures avant le début', () => {
    expect(rappelsDus(seance, a('2026-10-16T15:59:00Z'), [])).toEqual([])
    expect(rappelsDus(seance, a('2026-10-16T21:59:00Z'), [])).toEqual(['veille'])
    expect(rappelsDus(seance, a('2026-10-16T16:00:00Z'), [])).toEqual(['veille'])
    expect(rappelsDus(seance, a('2026-10-17T10:00:00Z'), ['veille'])).toEqual(['bientot'])
    expect(rappelsDus(seance, a('2026-10-17T10:30:00Z'), ['veille', 'bientot'])).toEqual([])
  })

  it('ne rattrape pas un rappel dépassé : seul le plus récent part', () => {
    expect(rappelsDus(seance, a('2026-10-17T10:15:00Z'), [])).toEqual(['bientot'])
  })

  it('« demain » ne part que la veille : passé minuit, il attend le rappel suivant', () => {
    expect(rappelsDus(seance, a('2026-10-16T22:30:00Z'), [])).toEqual([])
  })

  it('rien ne part pour un rappel dont l’heure était passée quand la séance a été fixée : l’annonce vient d’être faite', () => {
    const fixeeTard = { ...seance, fixeeLe: '2026-10-17T10:30:00Z' }
    expect(rappelsDus(fixeeTard, a('2026-10-17T10:31:00Z'), [])).toEqual([])
    const fixeeLeMatin = { ...seance, fixeeLe: '2026-10-17T07:00:00Z' }
    expect(rappelsDus(fixeeLeMatin, a('2026-10-17T10:01:00Z'), [])).toEqual(['bientot'])
  })

  it('se tait une fois la séance commencée', () => {
    expect(rappelsDus(seance, a('2026-10-17T12:01:00Z'), [])).toEqual([])
  })

  it('dit quand, où et à quelle heure', () => {
    expect(texteRappel(seance, 'veille')).toBe('Rappel : séance demain, samedi 17 octobre 2026, de 14 h à 20 h (Chez Tom).')
    expect(texteRappel({ ...seance, lieu: '' }, 'bientot')).toBe('La séance commence bientôt : samedi 17 octobre 2026, de 14 h à 20 h.')
  })
})

describe('relance de sondage', () => {
  const sondage = { id: 2, dateLimite: '2026-10-10' }
  it('part la veille de la date limite, à partir de 10 h, une seule fois', () => {
    expect(relanceDue(sondage, new Date('2026-10-09T07:59:00Z'), false)).toBe(false)
    expect(relanceDue(sondage, new Date('2026-10-09T08:00:00Z'), false)).toBe(true)
    expect(relanceDue(sondage, new Date('2026-10-09T08:00:00Z'), true)).toBe(false)
    expect(relanceDue(sondage, new Date('2026-10-09T21:59:00Z'), false)).toBe(true)
    // Le jour même, « se ferme demain » serait faux.
    expect(relanceDue(sondage, new Date('2026-10-09T22:01:00Z'), false)).toBe(false)
  })

  it('ne relance pas un sondage ouvert après l’heure de la relance', () => {
    expect(relanceDue({ ...sondage, creeLe: '2026-10-09T12:00:00Z' }, new Date('2026-10-09T12:01:00Z'), false)).toBe(false)
    expect(relanceDue({ ...sondage, creeLe: '2026-10-01T12:00:00Z' }, new Date('2026-10-09T12:01:00Z'), false)).toBe(true)
  })

  it('ne concerne pas un sondage sans date limite', () => {
    expect(relanceDue({ id: 2, dateLimite: null }, new Date(), false)).toBe(false)
  })
})

describe('nouveautesDuMonde', () => {
  const monde = (x = {}) => ({ iles: [{ id: 'aeronis', nom: 'Aéronis' }], missions: [{ id: 'm1', titre: 'L’Erreur de Mesure' }], nouvelles: [{ t: 'Session 1', titre: 'Recrutement', texte: '…' }], ...x })

  it('annonce une nouvelle publiée, une mission ouverte, une île révélée', () => {
    const avant = monde()
    const apres = monde({
      iles: [...avant.iles, { id: 'cendrebas', nom: 'Cendrebas' }],
      missions: [...avant.missions, { id: 'm2', titre: 'Les Mineurs qui ne dorment plus' }],
      nouvelles: [{ t: 'Session 2', titre: 'Trois morts dans leur sommeil', texte: '…' }, ...avant.nouvelles],
    })
    expect(nouveautesDuMonde(avant, apres)).toEqual([
      'Gazette des Vents : Trois morts dans leur sommeil.',
      'Nouvel ordre de mission : Les Mineurs qui ne dorment plus.',
      'Une île apparaît sur la carte : Cendrebas.',
    ])
  })

  it('reste muet quand rien de visible ne change', () => {
    expect(nouveautesDuMonde(monde(), monde())).toEqual([])
    expect(nouveautesDuMonde(monde(), monde({ iles: [] }))).toEqual([])
  })
})

describe('adresses d’envoi push', () => {
  it('n’accepte que les services push des navigateurs, en HTTPS', () => {
    expect(estAdressePushAutorisee('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(estAdressePushAutorisee('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true)
    expect(estAdressePushAutorisee('https://web.push.apple.com/QOs')).toBe(true)
    expect(estAdressePushAutorisee('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true)
    expect(estAdressePushAutorisee('http://fcm.googleapis.com/fcm/send/abc')).toBe(false)
    expect(estAdressePushAutorisee('https://169.254.169.254/latest')).toBe(false)
    expect(estAdressePushAutorisee('https://fcm.googleapis.com.pirate.fr/x')).toBe(false)
    expect(estAdressePushAutorisee('https://evilpush.apple.com.example/x')).toBe(false)
    expect(estAdressePushAutorisee('pas une adresse')).toBe(false)
    expect(estAdressePushAutorisee('https://fcm.googleapis.com:8443/x')).toBe(false)
    // Des caractères que d'autres lecteurs d'adresse coupent autrement : la machine réellement appelée changerait.
    for (const piege of [';', "'", '"', '{', '}', '`', '%3B', '\\']) {
      expect(estAdressePushAutorisee(`https://intranet.example${piege}.web.push.apple.com/x`)).toBe(false)
    }
    expect(estAdressePushAutorisee('https://FCM.googleapis.com/fcm/send/abc')).toBe(false)
  })
})
