<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue'
import Atlas from './components/Atlas.vue'

// La table du MJ n'existe qu'en développement : elle est retirée du site publié.
const modeMj = import.meta.env.DEV && window.location.hash === '#mj'
const TableDuMj = import.meta.env.DEV ? defineAsyncComponent(() => import('./mj/TableDuMj.vue')) : null

const monde = ref(null)
const erreur = ref('')

onMounted(async () => {
  if (modeMj) return
  try {
    const reponse = await fetch(`${import.meta.env.BASE_URL}monde.json`, { cache: 'no-cache' })
    if (!reponse.ok) throw new Error(String(reponse.status))
    monde.value = await reponse.json()
  } catch {
    erreur.value = "La carte n'a pas pu être chargée. Recharge la page ; si le problème continue, préviens le MJ."
  }
})
</script>

<template>
  <component :is="TableDuMj" v-if="modeMj" />
  <Atlas v-else-if="monde" :monde="monde" />
  <main v-else class="attente">
    <h1>Carte des Cieux d'Eldaria</h1>
    <p>{{ erreur || 'Dépliage de la carte…' }}</p>
  </main>
</template>

<style scoped>
.attente { max-width: 40rem; margin: 20vh auto 0; padding-inline: 16px; text-align: center; }
.attente p { color: var(--encre-2); }
</style>
