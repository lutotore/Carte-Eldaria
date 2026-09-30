import { dirname, join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { lireConfig } from './config.js'
import { ouvrirBase } from './infra/base.js'
import { creerStockageDisque } from './infra/stockageImages.js'
import { creerPortail } from './services/portail.js'

const AIDE = `Commandes disponibles :
  initialiser "<nom>"            crée une campagne et affiche le lien du propriétaire
  importer-etat <n° campagne> [fichier]
                                 remplace le monde de la campagne par ce fichier JSON
                                 (ou par ce qui arrive sur l'entrée standard)
  exporter-etat <n° campagne>    écrit le monde de la campagne sur la sortie standard
  importer-fiches <n° campagne> [fichier]
                                 ajoute les PNJ du fichier JSON (ou de l'entrée standard) à la bibliothèque, tous cachés
  reinitialiser <identifiant>    affiche un lien pour choisir un nouveau mot de passe
  purger                         efface les sessions et liens périmés`

/** Cœur de la ligne de commande, testable sans processus ni base réelle. */
export async function executerCommande([commande, argument, fichier], { portail, origine, lireEntree, lireFichier, ecrire }) {
  switch (commande) {
    case 'initialiser': {
      const { campagneId, jeton, expireLe } = portail.initialiserCampagne({ nom: argument })
      ecrire(`Campagne n° ${campagneId} créée.`)
      ecrire(`Ouvre ce lien pour créer ton compte de propriétaire (valable jusqu'au ${expireLe}) :`)
      ecrire(`${origine}/invitation/${jeton}`)
      return
    }
    case 'importer-etat': {
      const texte = fichier ? await lireFichier(fichier) : await lireEntree()
      portail.importerEtat(Number(argument), JSON.parse(texte))
      ecrire(`Monde importé dans la campagne n° ${argument}.`)
      return
    }
    case 'importer-fiches': {
      const texte = fichier ? await lireFichier(fichier) : await lireEntree()
      const { nombre } = portail.importerFiches(Number(argument), JSON.parse(texte))
      ecrire(`${nombre} fiche(s) importée(s), toutes cachées, dans la campagne n° ${argument}.`)
      return
    }
    case 'exporter-etat': {
      const campagneId = Number(argument)
      const { etat } = portail.etatPourAdministrateur(campagneId)
      ecrire(JSON.stringify(etat, null, 2))
      return
    }
    case 'reinitialiser': {
      const { jeton, expireLe } = portail.reinitialisationParAdministrateur({ identifiant: argument })
      ecrire(`Lien de réinitialisation pour « ${argument} » (valable jusqu'au ${expireLe}) :`)
      ecrire(`${origine}/reinitialisation/${jeton}`)
      return
    }
    case 'purger':
      ecrire(`${portail.purger()} élément(s) périmé(s) effacé(s).`)
      return
    default:
      throw new Error(AIDE)
  }
}

async function lireEntreeStandard() {
  let texte = ''
  for await (const bout of process.stdin) texte += bout
  return texte
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = lireConfig()
  const db = ouvrirBase(config.cheminBase)
  try {
    await executerCommande(process.argv.slice(2), {
      portail: creerPortail({ db, images: creerStockageDisque(join(dirname(config.cheminBase), 'images')) }),
      origine: config.origine,
      lireEntree: lireEntreeStandard,
      lireFichier: (chemin) => readFile(chemin, 'utf8'),
      ecrire: (ligne) => process.stdout.write(`${ligne}\n`),
    })
  } catch (erreur) {
    process.stderr.write(`${erreur.message}\n`)
    process.exitCode = 1
  } finally {
    db.close()
  }
}
