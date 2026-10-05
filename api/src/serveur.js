import { dirname, join } from 'node:path'
import { lireConfig } from './config.js'
import { construireApp } from './http/app.js'
import { ouvrirBase } from './infra/base.js'
import { creerStockageDisque } from './infra/stockageImages.js'
import { creerPortail } from './services/portail.js'
import { envoyeurWebPush } from './services/push.js'

const UN_JOUR_MS = 24 * 60 * 60 * 1000
const UNE_MINUTE_MS = 60 * 1000
const ENVOI_PUSH_MS = 10 * 1000

const config = lireConfig()
const db = ouvrirBase(config.cheminBase)
// Les portraits vivent à côté de la base (dossier donnees/images) : une seule chose à sauvegarder.
const portail = creerPortail({
  db,
  images: creerStockageDisque(join(dirname(config.cheminBase), 'images')),
  // Les services push demandent une adresse de contact : celle du site suffit.
  envoyeurPush: envoyeurWebPush({ contact: config.origine }),
})
const app = construireApp({ portail, config })

// Nettoyage des sessions et liens périmés au démarrage, puis chaque jour.
portail.purger()
const minuteur = setInterval(() => portail.purger(), UN_JOUR_MS)
minuteur.unref()

// Rappels de séance et relances de sondage, chaque minute ; notifications push en attente, toutes les dix secondes.
// Une erreur ici ne doit jamais arrêter le serveur : elle est journalisée, et la tournée suivante réessaie.
const rappels = setInterval(() => {
  try {
    portail.envoyerRappels()
  } catch (erreur) {
    app.log.error({ err: erreur }, 'Rappels : échec de la tournée.')
  }
}, UNE_MINUTE_MS)
rappels.unref()
let envoiEnCours = false
const envois = setInterval(async () => {
  if (envoiEnCours) return
  envoiEnCours = true
  try {
    await portail.envoyerPushEnAttente()
  } catch (erreur) {
    app.log.error({ err: erreur }, 'Notifications push : échec de la tournée.')
  } finally {
    envoiEnCours = false
  }
}, ENVOI_PUSH_MS)
envois.unref()

async function arreter(signal) {
  app.log.info(`${signal} reçu : arrêt propre.`)
  clearInterval(minuteur)
  clearInterval(rappels)
  clearInterval(envois)
  await app.close()
  db.close()
  process.exit(0)
}
process.on('SIGTERM', arreter)
process.on('SIGINT', arreter)

await app.listen({ port: config.port, host: config.hote })
