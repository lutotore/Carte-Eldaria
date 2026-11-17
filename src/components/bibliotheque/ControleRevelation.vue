<script setup>
import { computed, ref, watch } from 'vue'
import { basculer, modeDe } from './revelation.js'

/**
 * Qui voit cette facette. Un clic sur l'œil la révèle au groupe ou la cache ;
 * « À certains… » ouvre le choix des joueurs.
 */
const props = defineProps({
  revelations: { type: Array, required: true },
  joueurs: { type: Array, required: true },
  vide: { type: Boolean, default: false },
  enCours: { type: Boolean, default: false },
})
const emit = defineEmits(['changer'])

const mode = computed(() => modeDe(props.revelations))
const ouvert = ref(false)
const choisis = ref([])
watch(() => props.revelations, (revelations) => {
  choisis.value = revelations.filter((r) => !r.pourTous).map((r) => r.utilisateurId)
}, { immediate: true })

const resume = computed(() => {
  if (props.vide) return 'Vide : rien à révéler'
  if (mode.value === 'groupe') return 'Tout le groupe'
  if (mode.value === 'certains') {
    const noms = props.joueurs.filter((j) => choisis.value.includes(j.id)).map((j) => j.identifiant)
    return `${noms.join(', ')} seulement`
  }
  return 'Cachée'
})
const aide = computed(() => (mode.value === 'groupe' ? 'Cacher cette information' : 'Révéler cette information au groupe'))

const cliquer = () => emit('changer', basculer(props.revelations))
function choisirJoueurs() {
  emit('changer', choisis.value.length ? { pourTous: false, joueurs: choisis.value } : { pourTous: false, joueurs: [] })
}
</script>

<template>
  <div class="revelation" :class="`revelation--${mode}`">
    <button type="button" class="oeil" :disabled="vide || enCours" :aria-label="aide" :title="aide" :aria-pressed="mode === 'groupe'" @click="cliquer">
      <svg v-if="mode === 'personne'" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.8 9.8 0 0 0 5.4-1.6" /></svg>
      <svg v-else aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
    </button>
    <span class="resume">{{ resume }}</span>
    <button v-if="!vide && joueurs.length" type="button" class="certains" :aria-expanded="ouvert" @click="ouvert = !ouvert">À certains…</button>
    <fieldset v-if="ouvert" class="joueurs">
      <legend class="visuellement-cache">Joueurs qui voient cette information</legend>
      <label v-for="j in joueurs" :key="j.id">
        <input v-model="choisis" type="checkbox" :value="j.id" :disabled="enCours" @change="choisirJoueurs"> {{ j.identifiant }}
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.revelation { display: flex; flex-wrap: wrap; gap: 0.3rem 0.7rem; align-items: center; font-size: var(--t-s); }
.oeil {
  flex: none; width: 44px; height: 44px; border-radius: 50%; display: inline-grid; place-items: center; cursor: pointer;
  border: 1px solid var(--encre-2); background: transparent; color: var(--encre);
}
.oeil:disabled { opacity: 0.4; cursor: not-allowed; }
.revelation--groupe .oeil { border-color: var(--vert); background: var(--vert); color: #f6ecd4; }
.revelation--certains .oeil { border-color: var(--ocre-alerte); background: var(--ocre-alerte); color: #f6ecd4; }
.resume { color: var(--encre-2); font-style: italic; }
.revelation--groupe .resume { color: var(--vert); font-style: normal; font-weight: 700; }
.revelation--certains .resume { color: var(--ocre-alerte); font-style: normal; font-weight: 700; }
.certains {
  min-height: 44px; padding: 0 0.3rem; border: 0; background: none; color: var(--encre-2); font: inherit; cursor: pointer;
  text-decoration: underline; text-underline-offset: 3px;
}
.joueurs { flex-basis: 100%; border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; }
.joueurs label { min-height: 44px; display: inline-flex; gap: 0.35rem; align-items: center; }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
