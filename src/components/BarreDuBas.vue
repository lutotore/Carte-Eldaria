<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { campagneDe } from '../api/droits.js'
import { couperSurCetAppareil } from '../composables/push.js'
import { fermerSession, moi } from '../session.js'
import { estActif, liensDuPortail } from './navigation.js'

/** Sur téléphone : quatre liens au pouce, et « Plus » pour le reste du portail. */
const route = useRoute()
const router = useRouter()
const ouvert = ref(false)

const campagne = computed(() => campagneDe(moi.value, route.params.id))
const liens = computed(() => (campagne.value ? liensDuPortail(campagne.value) : []))
const enBas = computed(() => liens.value.filter((l) => l.enBas))
const ailleurs = computed(() => liens.value.filter((l) => !l.enBas))
const plusActif = computed(() => ailleurs.value.some((l) => estActif(l, route)) || route.name === 'compte')
const plusieursCampagnes = computed(() => (moi.value?.campagnes.length ?? 0) > 1)

watch(() => route.fullPath, () => { ouvert.value = false })

async function deconnexion() {
  await couperSurCetAppareil().catch(() => {})
  await router.push({ name: 'connexion' })
  await fermerSession()
}
</script>

<template>
  <nav v-if="campagne" class="bas" aria-label="Navigation principale">
    <div v-if="ouvert" id="menu-plus" class="plus papier">
      <ul>
        <li v-for="l in ailleurs" :key="l.cle"><RouterLink :to="l.to" :class="{ actif: estActif(l, route) }">{{ l.nom }}</RouterLink></li>
        <li><RouterLink to="/compte" :class="{ actif: route.name === 'compte' }">Mon compte ({{ moi.identifiant }})</RouterLink></li>
        <li v-if="plusieursCampagnes"><RouterLink to="/">Mes campagnes</RouterLink></li>
        <li><button type="button" @click="deconnexion">Se déconnecter</button></li>
      </ul>
    </div>
    <RouterLink v-for="l in enBas" :key="l.cle" :to="l.to" class="onglet" :class="{ actif: estActif(l, route) }" :aria-current="estActif(l, route) ? 'page' : undefined">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <template v-if="l.icone === 'carte'"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></template>
        <path v-else-if="l.icone === 'livres'" d="M4 4h6v16H4zM14 4h6v16h-6z" />
        <template v-else-if="l.icone === 'personne'"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></template>
        <template v-else><path d="M4 9h16v11H4z" /><path d="M3 5h18v4H3zM12 5v15" /></template>
      </svg>
      {{ l.court }}
    </RouterLink>
    <button type="button" class="onglet" :class="{ actif: plusActif || ouvert }" :aria-expanded="ouvert" aria-controls="menu-plus" @click="ouvert = !ouvert">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
      Plus
    </button>
  </nav>
</template>

<style scoped>
.bas { display: none; }
@media (max-width: 719px) {
  .bas {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
    display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
    padding: 0.35rem 0.25rem max(0.6rem, env(safe-area-inset-bottom));
    border-top: 1px solid var(--couture); background: #1f150e;
  }
}
.onglet {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.15rem; min-height: 48px;
  border: 0; background: none; color: #e8d6b0; font: inherit; font-size: var(--t-xs); text-decoration: none; cursor: pointer;
}
.onglet.actif { color: var(--laiton-clair); font-weight: 700; }
.plus { position: absolute; right: 0.5rem; bottom: calc(100% + 0.4rem); width: min(18rem, calc(100vw - 1rem)); max-height: 70vh; overflow-y: auto; border-radius: 4px; }
.plus ul { list-style: none; margin: 0; padding: 0.3rem 0; }
.plus a, .plus button {
  display: flex; align-items: center; width: 100%; min-height: 48px; padding: 0 1rem; box-sizing: border-box;
  border: 0; background: none; color: var(--encre); font: inherit; text-align: left; text-decoration: none; cursor: pointer;
}
.plus a.actif { font-weight: 700; color: var(--rouge); }
.plus li + li { border-top: 1px dashed var(--papier-ombre); }
</style>
