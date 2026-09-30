import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const NOM_SUR = /^[a-f0-9-]{36}$/

/** Portraits sur le disque du serveur, dans un dossier à côté de la base (donc sauvegardé avec elle). */
export function creerStockageDisque(dossier) {
  mkdirSync(dossier, { recursive: true })
  const chemin = (id) => {
    // L'identifiant vient de la base, mais on refuse tout ce qui pourrait sortir du dossier.
    if (!NOM_SUR.test(id)) throw new Error(`Identifiant d'image invalide : ${id}`)
    return join(dossier, id)
  }
  return {
    ecrire: (id, octets) => writeFileSync(chemin(id), octets),
    lire: (id) => {
      try { return readFileSync(chemin(id)) } catch { return null }
    },
    supprimer: (id) => rmSync(chemin(id), { force: true }),
  }
}

/** Même contrat, en mémoire : pour les tests. */
export function creerStockageMemoire() {
  const fichiers = new Map()
  return {
    ecrire: (id, octets) => { fichiers.set(id, Buffer.from(octets)) },
    lire: (id) => fichiers.get(id) ?? null,
    supprimer: (id) => { fichiers.delete(id) },
  }
}
