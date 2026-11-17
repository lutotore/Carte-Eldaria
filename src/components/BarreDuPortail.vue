<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { campagneDe, estMj } from '../api/droits.js'
import { fermerSession, moi } from '../session.js'
import { couperSurCetAppareil } from '../composables/push.js'
import { changerPupitre, pupitreDe } from '../composables/pupitre.js'
import Cloche from './Cloche.vue'
import { estActif, liensDuPortail } from './navigation.js'

const route = useRoute()
const router = useRouter()

const campagne = computed(() => (route.params.id ? campagneDe(moi.value, route.params.id) : null))
const liens = computed(() => (campagne.value ? liensDuPortail(campagne.value).filter((l) => l.enHaut !== false) : []))
const plusieursCampagnes = computed(() => (moi.value?.campagnes.length ?? 0) > 1)
const pupitreOuvert = computed(() => Boolean(campagne.value && pupitreDe(campagne.value.id).ouvert))
const basculerPupitre = () => changerPupitre(campagne.value.id, { ouvert: !pupitreOuvert.value })

// On quitte d'abord la page : elle n'a plus à s'afficher sans compte connecté.
async function deconnexion() {
  // Un appareil dont on se déconnecte ne reçoit plus les notifications de ce compte (pensé pour un ordinateur partagé).
  await couperSurCetAppareil().catch(() => {})
  await router.push({ name: 'connexion' })
  await fermerSession()
}
</script>

<template>
  <header class="barre">
    <nav class="navigation" aria-label="Navigation du portail">
      <RouterLink v-if="plusieursCampagnes" to="/" class="retour large">Mes campagnes</RouterLink>
      <span class="marque">{{ campagne?.nom ?? 'Eldaria' }}</span>
      <RouterLink v-for="l in liens" :key="l.cle" :to="l.to" class="large" :class="{ actif: estActif(l, route) }">{{ l.nom }}</RouterLink>
    </nav>
    <div class="compte">
      <button v-if="estMj(campagne)" type="button" class="seance" :aria-pressed="pupitreOuvert" @click="basculerPupitre">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        <span class="large-inline">Séance en cours</span><span class="etroit-inline">Séance</span>
      </button>
      <Cloche :campagne-id="campagne?.id ?? null" />
      <RouterLink to="/compte" active-class="actif" class="large">{{ moi.identifiant }}</RouterLink>
      <button type="button" class="deconnexion large" @click="deconnexion">Se déconnecter</button>
    </div>
  </header>
</template>

<style scoped>
.barre {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  padding: 0.6rem max(16px, env(safe-area-inset-left));
  border-bottom: 1px dashed var(--couture);
  background: rgba(0, 0, 0, 0.18);
}
.navigation { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.3rem 1.1rem; }
.compte { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 1.1rem; }
.marque { font-family: var(--f-titre); font-size: 1.25rem; color: var(--laiton-clair); text-decoration: none; }
.retour { font-size: var(--t-s); }
a { color: #e8d6b0; text-decoration: none; border-bottom: 1px solid transparent; }
a:hover { color: var(--laiton-clair); }
a.actif { color: var(--laiton-clair); border-bottom-color: var(--laiton); }
.seance {
  display: inline-flex; align-items: center; gap: 0.5rem; min-height: 40px; padding: 0 1rem; border-radius: 20px;
  border: 1px solid var(--couture); background: transparent; color: #e8d6b0; font: inherit; font-weight: 700; cursor: pointer;
}
.seance[aria-pressed='true'] { border-color: var(--laiton-clair); background: var(--laiton); color: var(--cuir); }
.deconnexion { background: none; border: 0; padding: 0; color: #cdb48c; text-decoration: underline; text-underline-offset: 3px; }
.deconnexion:hover { color: var(--laiton-clair); }
.etroit-inline { display: none; }
/* Sur téléphone, les liens passent dans la barre du bas (BarreDuBas) : en haut, le nom, la séance et la cloche. */
@media (max-width: 719px) {
  .large { display: none; }
  .large-inline { display: none; }
  .etroit-inline { display: inline; }
}
</style>
