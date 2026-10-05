<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '../api/client.js'
import EditeurFiche from '../components/bibliotheque/EditeurFiche.vue'
import NotesFiche from '../components/bibliotheque/NotesFiche.vue'
import { rubriqueDe } from '../components/bibliotheque/rubriques.js'
import VueFiche from '../components/bibliotheque/VueFiche.vue'

const props = defineProps({ id: { type: String, required: true }, ficheId: { type: String, required: true } })

const donnees = ref(null)
const typeFiche = computed(() => donnees.value?.type ?? donnees.value?.fiche?.type ?? 'pnj')
const retour = computed(() => {
  const rubrique = rubriqueDe(typeFiche.value)
  return { nom: rubrique.liste, texte: `← ${rubrique.titre}` }
})
const erreur = ref('')

async function charger() {
  try {
    donnees.value = await api.fiche(props.id, props.ficheId)
    erreur.value = ''
  } catch (e) {
    erreur.value = e.code === 'introuvable' ? 'Cette fiche n’existe pas, ou tu n’en sais encore rien.' : e.message
  }
}
onMounted(charger)
watch(() => props.ficheId, charger)
</script>

<template>
  <main class="page-fiche">
    <RouterLink :to="{ name: retour.nom, params: { id } }" class="retour">{{ retour.texte }}</RouterLink>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
    <template v-else-if="donnees">
      <EditeurFiche v-if="donnees.estMj" :key="donnees.id" :campagne-id="id" :fiche="donnees" @recharger="charger" />
      <VueFiche v-else :campagne-id="id" :fiche="donnees.fiche" :grille="donnees.grille" @recharger="charger" />
      <NotesFiche :campagne-id="id" :fiche-id="Number(ficheId)" :notes="donnees.notes" :est-mj="donnees.estMj" :lectures="donnees.lectures ?? []" @recharger="charger" />
    </template>
    <p v-else class="attente">Ouverture de la fiche…</p>
  </main>
</template>

<style scoped>
.page-fiche { max-width: 900px; margin: 0 auto; padding: 1.2rem max(16px, env(safe-area-inset-left)) 2rem; display: flex; flex-direction: column; gap: 1.2rem; }
.retour { color: #cdb48c; text-decoration: none; }
.retour:hover { color: var(--laiton-clair); }
.message--erreur { background: var(--papier); }
.attente { color: #cdb48c; font-style: italic; }
</style>
