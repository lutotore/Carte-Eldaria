<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { campagneDe, estMj, estProprietaire } from '../api/droits.js'
import { fermerSession, moi } from '../session.js'
import Cloche from './Cloche.vue'

const route = useRoute()
const router = useRouter()

const campagne = computed(() => (route.params.id ? campagneDe(moi.value, route.params.id) : null))
const plusieursCampagnes = computed(() => (moi.value?.campagnes.length ?? 0) > 1)

// On quitte d'abord la page : elle n'a plus à s'afficher sans compte connecté.
async function deconnexion() {
  await router.push({ name: 'connexion' })
  await fermerSession()
}
</script>

<template>
  <header class="barre">
    <nav class="navigation" aria-label="Navigation du portail">
      <RouterLink v-if="plusieursCampagnes" to="/" class="retour">Mes campagnes</RouterLink>
      <span class="marque">{{ campagne?.nom ?? 'Eldaria' }}</span>
      <template v-if="campagne">
        <RouterLink :to="{ name: 'carte', params: { id: campagne.id } }" exact-active-class="actif">Carte</RouterLink>
        <RouterLink :to="{ name: 'seances', params: { id: campagne.id } }" active-class="actif">Séances</RouterLink>
        <RouterLink :to="{ name: 'bibliotheque', params: { id: campagne.id } }" active-class="actif">Bibliothèque</RouterLink>
        <RouterLink :to="{ name: 'bestiaire', params: { id: campagne.id } }" active-class="actif">Bestiaire</RouterLink>
        <RouterLink v-if="estMj(campagne)" :to="{ name: 'mj', params: { id: campagne.id } }" active-class="actif">Table du MJ</RouterLink>
        <RouterLink v-if="estProprietaire(campagne)" :to="{ name: 'membres', params: { id: campagne.id } }" active-class="actif">Membres</RouterLink>
      </template>
    </nav>
    <div class="compte">
      <Cloche />
      <RouterLink to="/compte" active-class="actif">{{ moi.identifiant }}</RouterLink>
      <button type="button" class="deconnexion" @click="deconnexion">Se déconnecter</button>
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
.deconnexion { background: none; border: 0; padding: 0; color: #cdb48c; text-decoration: underline; text-underline-offset: 3px; }
.deconnexion:hover { color: var(--laiton-clair); }
</style>
