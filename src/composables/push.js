import { api } from '../api/client.js'

/**
 * Notifications push dans le navigateur : service worker, permission, abonnement.
 * Chaque appareil s'abonne séparément ; le serveur ne garde que ce que le navigateur lui donne.
 */

/** Clé publique du serveur (base64url) → octets, comme l'attend pushManager.subscribe. */
export function base64urlVersOctets(texte) {
  const base64 = texte.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(texte.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

/** « iPhone · Safari », « Windows · Edge »… pour reconnaître ses appareils dans « Mon compte ». */
export function nomAppareil(agent) {
  const systeme = [[/iPhone/, 'iPhone'], [/iPad/, 'iPad'], [/Android/, 'Android'], [/Windows/, 'Windows'], [/Macintosh|Mac OS X/, 'Mac'], [/Linux/, 'Linux']]
    .find(([motif]) => motif.test(agent))?.[1]
  const navigateur = [[/Edg\//, 'Edge'], [/Firefox\//, 'Firefox'], [/Chrome\//, 'Chrome'], [/Safari\//, 'Safari']]
    .find(([motif]) => motif.test(agent))?.[1]
  return [systeme, navigateur].filter(Boolean).join(' · ') || 'Appareil'
}

/**
 * Sur iPhone et iPad, les notifications web n'existent que pour un site ajouté à l'écran d'accueil.
 * Un iPad récent se présente comme un Mac : on le reconnaît à son écran tactile.
 */
export const doitInstallerSurIos = (agent, installe, pointsTactiles = 0) => (
  /iPhone|iPad/.test(agent) || (/Macintosh/.test(agent) && pointsTactiles > 1)) && !installe

export const estInstalle = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export const pushPossible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function enregistrement() {
  return navigator.serviceWorker.register('/sw.js')
}

/** L'abonnement de ce navigateur, s'il en a un (sans installer le service worker s'il ne l'est pas). */
export async function abonnementActuel() {
  if (!pushPossible()) return null
  const sw = await navigator.serviceWorker.getRegistration('/')
  return sw ? sw.pushManager.getSubscription() : null
}

/** Vrai si ce navigateur est abonné et que le serveur le connaît encore pour ce compte. */
export async function actifSurCetAppareil() {
  const abonnement = await abonnementActuel()
  if (!abonnement) return false
  return (await api.verifierPush(abonnement.endpoint)).abonne
}

export async function activerSurCetAppareil(cle) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur, puis réessaie.')
  }
  const sw = await enregistrement()
  await navigator.serviceWorker.ready
  let abonnement
  try {
    abonnement = await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64urlVersOctets(cle) })
  } catch {
    // Navigation privée, service de notifications du navigateur injoignable, appareil sans compte Google…
    throw new Error('Ton navigateur n’a pas réussi à s’abonner aux notifications. Vérifie que tu n’es pas en navigation privée, puis réessaie.')
  }
  await api.abonnerPush(abonnement.toJSON(), nomAppareil(navigator.userAgent))
}

export async function couperSurCetAppareil() {
  const abonnement = await abonnementActuel()
  if (!abonnement) return
  await api.desabonnerPush(abonnement.endpoint).catch(() => {})
  await abonnement.unsubscribe()
}
