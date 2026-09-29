import { createRouter, createWebHistory } from 'vue-router'
import { campagneDe, estMj, estProprietaire } from './api/droits.js'
import { chargerMoi, moi } from './session.js'

const page = (nom) => () => import(`./pages/${nom}.vue`)

const routes = [
  { path: '/connexion', name: 'connexion', component: page('PageConnexion'), meta: { titre: 'Connexion' } },
  { path: '/invitation/:jeton', name: 'invitation', component: page('PageInvitation'), props: true, meta: { titre: 'Invitation' } },
  { path: '/reinitialisation/:jeton', name: 'reinitialisation', component: page('PageReinitialisation'), props: true, meta: { titre: 'Nouveau mot de passe' } },
  { path: '/mentions-legales', name: 'mentions', component: page('PageMentionsLegales'), meta: { titre: 'Mentions légales' } },
  { path: '/confidentialite', name: 'confidentialite', component: page('PageConfidentialite'), meta: { titre: 'Confidentialité et cookies' } },

  { path: '/', name: 'accueil', component: page('PageAccueil'), meta: { connecte: true, titre: 'Mes campagnes' } },
  { path: '/compte', name: 'compte', component: page('PageCompte'), meta: { connecte: true, titre: 'Mon compte' } },
  { path: '/campagne/:id', name: 'carte', component: page('PageCarte'), props: true, meta: { connecte: true, membre: true, titre: 'Carte' } },
  { path: '/campagne/:id/mj', name: 'mj', component: () => import('./mj/TableDuMj.vue'), props: true, meta: { connecte: true, mj: true, titre: 'Table du MJ' } },
  { path: '/campagne/:id/membres', name: 'membres', component: page('PageMembres'), props: true, meta: { connecte: true, proprietaire: true, titre: 'Membres' } },

  { path: '/:reste(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (vers) => {
  if (!vers.meta.connecte) return true
  await chargerMoi()
  if (!moi.value) return { name: 'connexion', query: { suite: vers.fullPath } }

  // Les liens réservés sont cachés dans l'interface ; ce contrôle évite seulement une page vide.
  const campagne = vers.params.id ? campagneDe(moi.value, vers.params.id) : null
  if (vers.meta.membre && !campagne) return { name: 'accueil' }
  if (vers.meta.mj && !estMj(campagne)) return { name: 'accueil' }
  if (vers.meta.proprietaire && !estProprietaire(campagne)) return { name: 'accueil' }
  return true
})

router.afterEach((vers) => {
  document.title = vers.meta.titre ? `${vers.meta.titre} · Eldaria` : 'Eldaria'
})
