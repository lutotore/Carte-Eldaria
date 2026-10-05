import { describe, expect, it } from 'vitest'
import { base64urlVersOctets, doitInstallerSurIos, nomAppareil } from '../../src/composables/push.js'

describe('notifications push côté navigateur', () => {
  it('décode la clé publique du serveur (base64url) pour le navigateur', () => {
    expect([...base64urlVersOctets('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })

  it('donne un nom lisible à l’appareil, pour s’y retrouver dans « Mon compte »', () => {
    expect(nomAppareil('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari')
    expect(nomAppareil('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36')).toBe('Android · Chrome')
    expect(nomAppareil('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36 Edg/125.0')).toBe('Windows · Edge')
    expect(nomAppareil('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:126.0) Gecko/20100101 Firefox/126.0')).toBe('Mac · Firefox')
    expect(nomAppareil('Inconnu')).toBe('Appareil')
  })

  it('sur iPhone, il faut d’abord ajouter le site à l’écran d’accueil', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1'
    expect(doitInstallerSurIos(iphone, false)).toBe(true)
    expect(doitInstallerSurIos(iphone, true)).toBe(false)
    expect(doitInstallerSurIos('Mozilla/5.0 (Linux; Android 14) Chrome/125.0', false)).toBe(false)
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15'
    expect(doitInstallerSurIos(ipad, false, 5)).toBe(true)
    expect(doitInstallerSurIos(ipad, false, 0)).toBe(false)
  })
})
