<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from '../api/client.js'
import Atlas from '../components/Atlas.vue'

const props = defineProps({ id: { type: String, required: true } })

const monde = ref(null)
const erreur = ref('')

async function charger() {
  try {
    monde.value = await api.monde(props.id)
    erreur.value = ''
  } catch (e) {
    if (!monde.value) erreur.value = e.message
  }
}

// La carte se met à jour quand on revient sur l'onglet : pratique pendant une séance.
function auRetour() {
  if (document.visibilityState === 'visible') charger()
}

onMounted(() => {
  charger()
  document.addEventListener('visibilitychange', auRetour)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', auRetour))
watch(() => props.id, () => { monde.value = null; charger() })
</script>

<template>
  <Atlas v-if="monde" :monde="monde" />
  <main v-else class="page-feuille">
    <section class="feuille papier">
      <h1>Carte des Cieux d'Eldaria</h1>
      <p :class="erreur ? 'message message--erreur' : 'chapeau'">{{ erreur || 'Dépliage de la carte…' }}</p>
    </section>
  </main>
</template>
