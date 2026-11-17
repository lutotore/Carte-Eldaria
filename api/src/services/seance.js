import { erreurScene, etatDesFacettes, facettesVisees, resumeSelecteurs } from '../../../src/domain/scenes.js'
import { erreurs } from '../domaine/erreurs.js'
import { estMj } from '../domaine/roles.js'
import { transaction } from '../infra/base.js'
import { creerDepotsPersonnages } from '../infra/depotsPersonnages.js'
import { creerDepotsSeance } from '../infra/depotsSeance.js'

const SCENES_MAX = 200
const PIECES = ['pp', 'po', 'pe', 'pa', 'pc']

/** Ce que contient un butin, en une ligne : « 40 po · Larme brute ×4 · la pioche ». */
function resumeButin(butin, objets) {
  const pieces = PIECES.filter((p) => butin.pieces?.[p] > 0).map((p) => `${butin.pieces[p]} ${p}`)
  const lignes = objets.filter((o) => o.quantite > 0).map((o) => (o.quantite > 1 ? `${o.libelle} ×${o.quantite}` : o.libelle))
  return [...pieces, ...lignes].join(' · ')
}

/**
 * Pupitre de séance : les scènes préparées par le MJ, et leur révélation d'un geste.
 * Les révélations passent par la bibliothèque (mêmes règles, mêmes notifications).
 */
export function creerSeance({ db, depots, maintenant, bibliotheque }) {
  const seance = creerDepotsSeance(db)
  const persos = creerDepotsPersonnages(db)
  const iso = () => maintenant().toISOString()

  function exiger(condition, erreur) {
    if (!condition) throw erreur
  }
  const exigerMj = (demandeurId, campagneId) => exiger(estMj(depots.participations.role(demandeurId, campagneId)), erreurs.interdit())

  /** Les éléments d'une scène reliés à leur fiche ; ceux dont la fiche a disparu sont ignorés. */
  function elementsDe(scene, fiches) {
    return scene.elements.map((element) => {
      const fiche = fiches.get(element.ficheId)
      return fiche ? { element, fiche, visees: facettesVisees(fiche.facettes, element.facettes) } : null
    }).filter(Boolean)
  }

  function vueButin(butinId, campagneId) {
    const butin = butinId ? persos.butins.parId(butinId, campagneId) : null
    return butin ? { id: butin.id, titre: butin.titre, statut: butin.statut, resume: resumeButin(butin, persos.objetsButin.du(butin.id)) } : null
  }

  /** Relie une fiche du fichier d'import (type et nom) à celle de la bibliothèque. */
  function indexDesFiches(campagneId) {
    const nomDe = (fiche) => fiche.facettes.find((f) => f.cle === 'nom')?.valeur ?? ''
    return new Map(bibliotheque.fichesCompletesDe(campagneId).map((f) => [`${f.type}|${nomDe(f)}`, f.id]))
  }

  function verifierImport(donnees) {
    exiger(Array.isArray(donnees?.scenes), erreurs.requeteInvalide('Fichier invalide : liste « scenes » attendue.'))
    exiger(donnees.scenes.length <= SCENES_MAX, erreurs.requeteInvalide(`${SCENES_MAX} scènes au plus.`))
    exiger(donnees.fiches === undefined || Array.isArray(donnees.fiches), erreurs.requeteInvalide('Fichier invalide : « fiches » doit être une liste.'))
    for (const scene of donnees.scenes) {
      const elements = Array.isArray(scene?.elements) ? scene.elements : null
      exiger(elements && elements.every((e) => typeof e?.type === 'string' && typeof e?.nom === 'string'),
        erreurs.requeteInvalide(`Scène « ${scene?.titre ?? '?'} » : chaque élément a un type et un nom.`))
      const probleme = erreurScene({ ...scene, elements: elements.map((e) => ({ ficheId: 0, facettes: e.facettes ?? [] })) })
      exiger(!probleme, erreurs.requeteInvalide(`Scène « ${scene?.titre ?? '?'} » : ${probleme}`))
    }
  }

  return {
    /** MJ : les scènes dans l'ordre, chaque élément avec ce qu'il révèle et ce que les joueurs en savent déjà. */
    scenes({ demandeurId, campagneId }) {
      exigerMj(demandeurId, campagneId)
      const fiches = new Map(bibliotheque.fichesCompletesDe(campagneId).map((f) => [f.id, f]))
      return {
        scenes: seance.scenes.deLaCampagne(campagneId).map((scene) => ({
          id: scene.id,
          titre: scene.titre,
          sousTitre: scene.sousTitre,
          suite: scene.suite,
          butin: vueButin(scene.butinId, campagneId),
          elements: elementsDe(scene, fiches).map(({ element, fiche, visees }) => ({
            ficheId: fiche.id,
            type: fiche.type,
            nom: fiche.facettes.find((f) => f.cle === 'nom')?.valeur ?? '',
            quoi: resumeSelecteurs(fiche.type, element.facettes),
            etat: etatDesFacettes(visees),
          })),
        })),
        joueurs: bibliotheque.joueursDe(campagneId).map(({ id, identifiant }) => ({ id, identifiant })),
      }
    },

    /** Toute la scène, ou un seul de ses éléments (`element` : sa position), au groupe, à certains, ou caché. */
    revelerScene({ demandeurId, campagneId, sceneId, element = null, pourTous = false, joueurs = [], masquer = false }) {
      exigerMj(demandeurId, campagneId)
      const scene = seance.scenes.parId(sceneId, campagneId)
      exiger(scene, erreurs.introuvable('Scène'))
      const fiches = new Map(bibliotheque.fichesCompletesDe(campagneId).map((f) => [f.id, f]))
      const elements = elementsDe(scene, fiches)
      let choisis = elements
      if (element !== null) {
        exiger(Number.isInteger(element) && elements[element], erreurs.introuvable('Élément de scène'))
        choisis = [elements[element]]
      }
      const groupes = choisis.map(({ fiche, visees }) => ({ ficheId: fiche.id, facetteIds: visees.map((f) => f.id) }))
      bibliotheque.revelerDesFacettes(campagneId, groupes, { pourTous, joueurs, masquer: masquer === true })
    },

    /**
     * Import des scènes préparées (ligne de commande) : remplace celles de la campagne.
     * Les fiches fournies qui manquent sont créées (cachées) ; une fiche ou un butin introuvable est signalé, pas bloquant.
     */
    importerScenes(campagneId, donnees) {
      exiger(depots.campagnes.parId(campagneId), erreurs.introuvable('Campagne'))
      verifierImport(donnees)
      const existantes = indexDesFiches(campagneId)
      const aCreer = (donnees.fiches ?? []).filter((f) => !existantes.has(`${f.type ?? 'pnj'}|${String(f.nom ?? '').trim()}`))
      // Les fiches d'abord (leur import a sa propre transaction) : elles arrivent cachées, sans risque.
      if (aCreer.length) bibliotheque.importerFiches(campagneId, { fiches: aCreer })
      return transaction(db, () => {
        const index = indexDesFiches(campagneId)
        const butins = new Map(persos.butins.deLaCampagne(campagneId).map((b) => [b.titre, b.id]))
        const introuvables = []
        seance.scenes.viderLaCampagne(campagneId)
        donnees.scenes.forEach((scene, ordre) => {
          const elements = scene.elements.map((e) => {
            const ficheId = index.get(`${e.type}|${e.nom.trim()}`)
            if (!ficheId) introuvables.push(`${e.type} « ${e.nom} »`)
            return ficheId ? { ficheId, facettes: e.facettes ?? [] } : null
          }).filter(Boolean)
          const butinId = scene.butin ? butins.get(scene.butin) ?? null : null
          if (scene.butin && !butinId) introuvables.push(`butin « ${scene.butin} »`)
          seance.scenes.creer({
            campagneId, ordre, titre: scene.titre.trim(), sousTitre: scene.sousTitre ?? '', suite: scene.suite ?? '', elements, butinId, creeLe: iso(),
          })
        })
        return { scenes: donnees.scenes.length, fichesCreees: aCreer.length, introuvables }
      })
    },
  }
}
