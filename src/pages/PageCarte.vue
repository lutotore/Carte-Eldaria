<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api/client.js'
import Atlas from '../components/Atlas.vue'
import { lieuxParIle } from '../components/bibliotheque/rubriques.js'

const props = defineProps({ id: { type: String, required: true } })
const route = useRoute()

const monde = ref(null)
const lieux = ref(new Map())
const erreur = ref('')

async function charger() {
  try {
    const [m, l] = await Promise.all([
      api.monde(props.id),
      // Les lieux sont un plus : la carte s'affiche même si leur liste ne vient pas.
      api.bibliotheque(props.id, 'lieu').catch(() => null),
    ])
    monde.value = m
    // Pour un MJ, la liste contient aussi les lieux jamais révélés : la carte, elle, montre ce que voient les joueurs.
    if (l) lieux.value = lieuxParIle(l.fiches.filter((f) => f.revelation !== 'cache'))
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
watch(() => props.id, () => { monde.value = null; lieux.value = new Map(); charger() })
</script>

<template>
  <Atlas v-if="monde" :monde="monde" :lieux="lieux" :campagne-id="id" :ile-initiale="typeof route.query.ile === 'string' ? route.query.ile : null" />
  <main v-else class="page-feuille">
    <section class="feuille papier">
      <h1>Carte des Cieux d'Eldaria</h1>
      <p :class="erreur ? 'message message--erreur' : 'chapeau'">{{ erreur || 'Dépliage de la carte…' }}</p>
    </section>
  </main>
</template>
