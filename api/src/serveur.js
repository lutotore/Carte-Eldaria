import { dirname, join } from 'node:path'
import { lireConfig } from './config.js'
import { construireApp } from './http/app.js'
import { ouvrirBase } from './infra/base.js'
import { creerStockageDisque } from './infra/stockageImages.js'
import { creerPortail } from './services/portail.js'

const UN_JOUR_MS = 24 * 60 * 60 * 1000

const config = lireConfig()
const db = ouvrirBase(config.cheminBase)
// Les portraits vivent à côté de la base (dossier donnees/images) : une seule chose à sauvegarder.
const portail = creerPortail({ db, images: creerStockageDisque(join(dirname(config.cheminBase), 'images')) })
const app = construireApp({ portail, config })

// Nettoyage des sessions et liens périmés au démarrage, puis chaque jour.
portail.purger()
const minuteur = setInterval(() => portail.purger(), UN_JOUR_MS)
minuteur.unref()

async function arreter(signal) {
  app.log.info(`${signal} reçu : arrêt propre.`)
  clearInterval(minuteur)
  await app.close()
  db.close()
  process.exit(0)
}
process.on('SIGTERM', arreter)
process.on('SIGINT', arreter)

await app.listen({ port: config.port, host: config.hote })
