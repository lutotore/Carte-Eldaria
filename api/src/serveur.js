import { lireConfig } from './config.js'
import { construireApp } from './http/app.js'
import { ouvrirBase } from './infra/base.js'
import { creerPortail } from './services/portail.js'

const UN_JOUR_MS = 24 * 60 * 60 * 1000

const config = lireConfig()
const db = ouvrirBase(config.cheminBase)
const portail = creerPortail({ db })
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
