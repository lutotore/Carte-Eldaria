import { ref } from 'vue'
import { api } from './api/client.js'

/** Le compte connecté (null si personne), partagé par toutes les pages. */
export const moi = ref(null)
let chargement = null

/** Demande au serveur qui est connecté ; ne le fait qu'une fois tant qu'on ne force pas. */
export function chargerMoi({ forcer = false } = {}) {
  if (!chargement || forcer) {
    chargement = api.moi()
      .then((profil) => { moi.value = profil })
      .catch((erreur) => {
        moi.value = null
        if (erreur.statut !== 401) throw erreur
      })
  }
  return chargement
}

export function ouvrirSession(profil) {
  moi.value = profil
  chargement = Promise.resolve()
}

export async function fermerSession() {
  await api.deconnecter().catch(() => {})
  moi.value = null
  chargement = Promise.resolve()
}
