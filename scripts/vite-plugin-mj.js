import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { versPublic } from '../src/domain/projection.js'

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..')
const FICHIER_MJ = resolve(RACINE, 'mj/etat.json')
const FICHIER_PUBLIC = resolve(RACINE, 'public/monde.json')

async function ecrireAtomique(chemin, contenu) {
  await mkdir(dirname(chemin), { recursive: true })
  const tmp = `${chemin}.tmp`
  await writeFile(tmp, contenu, 'utf8')
  await rename(tmp, chemin)
}

function lireCorps(req) {
  return new Promise((ok, ko) => {
    let corps = ''
    req.on('data', (bout) => { corps += bout })
    req.on('end', () => ok(corps))
    req.on('error', ko)
  })
}

function repondre(res, code, donnees) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(donnees))
}

function estUnEtatValide(etat) {
  return etat && typeof etat === 'object' && etat.regles && etat.iles && etat.missions && Number.isInteger(etat.horloge)
}

/**
 * Table du MJ : n'existe qu'en développement (`npm run mj`).
 * Lit et écrit mj/etat.json (jamais versionné) et régénère public/monde.json,
 * la seule chose que les joueurs verront une fois le site publié.
 */
export function tableDuMj() {
  return {
    name: 'table-du-mj',
    apply: 'serve',
    config: () => ({ server: { watch: { ignored: ['**/mj/**', '**/public/monde.json'] } } }),
    configureServer(server) {
      server.middlewares.use('/__mj/etat', async (req, res) => {
        try {
          if (req.method === 'GET') {
            const contenu = await readFile(FICHIER_MJ, 'utf8').catch(() => null)
            if (contenu === null) return repondre(res, 404, { erreur: 'Fichier mj/etat.json introuvable.' })
            return repondre(res, 200, JSON.parse(contenu))
          }
          if (req.method === 'PUT') {
            const etat = JSON.parse(await lireCorps(req))
            if (!estUnEtatValide(etat)) return repondre(res, 400, { erreur: 'État du monde incomplet : rien n’a été écrit.' })
            await ecrireAtomique(FICHIER_MJ, `${JSON.stringify(etat, null, 2)}\n`)
            await ecrireAtomique(FICHIER_PUBLIC, `${JSON.stringify(versPublic(etat), null, 2)}\n`)
            return repondre(res, 200, { ok: true })
          }
          return repondre(res, 405, { erreur: 'Méthode non prise en charge.' })
        } catch (erreur) {
          return repondre(res, 500, { erreur: erreur.message })
        }
      })
    },
  }
}
