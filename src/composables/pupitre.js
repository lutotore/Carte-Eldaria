import { reactive } from 'vue'

const PAR_DEFAUT = { ouvert: false, scene: 0 }
const cleDe = (campagneId) => `eldaria:pupitre:${campagneId}`

/**
 * Ce dont le pupitre se souvient sur cet appareil, par campagne : ouvert ou non, scène en cours.
 * Le stockage du navigateur peut manquer ou refuser : on retombe alors sur les valeurs par défaut.
 */
export function memoireDuPupitre(stockage) {
  return {
    lire(campagneId) {
      try {
        const lu = JSON.parse(stockage?.getItem(cleDe(campagneId)) ?? 'null')
        return { ouvert: lu?.ouvert === true, scene: Number.isInteger(lu?.scene) ? lu.scene : 0 }
      } catch {
        return { ...PAR_DEFAUT }
      }
    },
    ecrire(campagneId, valeur) {
      try {
        stockage?.setItem(cleDe(campagneId), JSON.stringify(valeur))
      } catch {
        // Navigation privée ou stockage plein : le pupitre marche quand même, il oubliera seulement.
      }
    },
  }
}

/** Position valide dans une liste de `nombre` scènes. */
export const sceneBornee = (position, nombre) => Math.max(0, Math.min(position, nombre - 1))

const navigateur = typeof window === 'undefined' ? null : (() => {
  try {
    return window.localStorage
  } catch {
    return null
  }
})()
const memoire = memoireDuPupitre(navigateur)
const etats = reactive({})

/** L'état du pupitre d'une campagne, partagé entre la barre du portail et le pupitre lui-même. */
export function pupitreDe(campagneId) {
  if (!etats[campagneId]) etats[campagneId] = memoire.lire(campagneId)
  return etats[campagneId]
}

export function changerPupitre(campagneId, changement) {
  Object.assign(pupitreDe(campagneId), changement)
  memoire.ecrire(campagneId, { ...pupitreDe(campagneId) })
}
