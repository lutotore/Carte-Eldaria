/*
 * Service worker du portail : il ne sert qu'aux notifications push.
 * Aucune page n'est mise en cache ici : le site reste toujours celui du serveur.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evenement) => evenement.waitUntil(self.clients.claim()))

self.addEventListener('push', (evenement) => {
  let message = {}
  try {
    message = evenement.data ? evenement.data.json() : {}
  } catch {
    message = { texte: evenement.data ? evenement.data.text() : '' }
  }
  // Seules les pages du portail : « //ailleurs.fr » ou « javascript: » ramènent à l'accueil.
  let lien = '/'
  try {
    const adresse = new URL(String(message.lien ?? '/'), self.location.origin)
    if (adresse.origin === self.location.origin) lien = adresse.pathname + adresse.search
  } catch {
    lien = '/'
  }
  evenement.waitUntil(self.registration.showNotification(message.titre || 'Eldaria', {
    body: message.texte || 'Du nouveau sur le portail.',
    icon: '/icone-192.png',
    badge: '/icone-192.png',
    lang: 'fr',
    data: { lien },
  }))
})

// Un clic ouvre la page concernée, dans un onglet du portail déjà ouvert s'il y en a un.
self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close()
  const adresse = new URL(evenement.notification.data?.lien || '/', self.location.origin).href
  evenement.waitUntil((async () => {
    const onglets = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const onglet = onglets.find((c) => new URL(c.url).origin === self.location.origin)
    if (onglet) {
      await onglet.focus()
      // Un onglet que ce service worker ne contrôle pas refuse navigate() : on ouvre alors la page à part.
      const ouvert = await onglet.navigate(adresse).catch(() => null)
      if (ouvert) return ouvert
    }
    return self.clients.openWindow(adresse)
  })())
})
