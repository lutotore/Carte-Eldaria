<script setup>
import { computed, ref, watch } from 'vue'

/** Qui voit cette facette : personne, tout le groupe, ou certains joueurs. */
const props = defineProps({
  revelations: { type: Array, required: true },
  joueurs: { type: Array, required: true },
  vide: { type: Boolean, default: false },
  enCours: { type: Boolean, default: false },
})
const emit = defineEmits(['changer'])

const mode = ref('personne')
const choisis = ref([])
function depuisProps() {
  if (props.revelations.some((r) => r.pourTous)) mode.value = 'groupe'
  else if (props.revelations.length) mode.value = 'certains'
  else mode.value = 'personne'
  choisis.value = props.revelations.filter((r) => !r.pourTous).map((r) => r.utilisateurId)
}
watch(() => props.revelations, depuisProps, { immediate: true })

const resume = computed(() => {
  if (mode.value === 'groupe') return 'Visible de tout le groupe'
  if (mode.value === 'certains') {
    const noms = props.joueurs.filter((j) => choisis.value.includes(j.id)).map((j) => j.identifiant)
    return noms.length ? `Visible de : ${noms.join(', ')}` : 'Choisis au moins un joueur'
  }
  return 'Cachée'
})

function appliquer() {
  if (mode.value === 'certains' && !choisis.value.length) return
  emit('changer', { pourTous: mode.value === 'groupe', joueurs: mode.value === 'certains' ? choisis.value : [] })
}
</script>

<template>
  <div class="revelation" :class="`revelation--${mode}`">
    <select v-model="mode" :disabled="vide || enCours" aria-label="Qui voit cette information" @change="appliquer">
      <option value="personne">Cachée</option>
      <option value="groupe">Révélée au groupe</option>
      <option value="certains">Révélée à certains…</option>
    </select>
    <fieldset v-if="mode === 'certains'" class="joueurs">
      <legend class="visuellement-cache">Joueurs</legend>
      <label v-for="j in joueurs" :key="j.id">
        <input v-model="choisis" type="checkbox" :value="j.id" :disabled="enCours" @change="appliquer"> {{ j.identifiant }}
      </label>
    </fieldset>
    <span class="resume">{{ vide ? 'Vide : rien à révéler' : resume }}</span>
  </div>
</template>

<style scoped>
.revelation { display: flex; flex-wrap: wrap; gap: 0.3rem 0.7rem; align-items: center; font-size: var(--t-s); }
select { border: 1px solid var(--papier-ombre); border-radius: 3px; background: #f6ecd4; padding: 0.2rem 0.35rem; color: var(--encre); }
.revelation--groupe select { border-color: var(--vert); color: var(--vert); font-weight: 700; }
.revelation--certains select { border-color: var(--ocre-alerte); color: var(--ocre-alerte); font-weight: 700; }
.joueurs { border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; }
.joueurs label { display: inline-flex; gap: 0.25rem; align-items: center; }
.resume { color: var(--encre-2); font-style: italic; }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
