<script setup>
import { NOMS_STATUT_MISSION } from '../composables/format.js'

defineProps({
  mission: { type: Object, required: true },
  nomIle: { type: String, default: 'Lieu inconnu' },
})
</script>

<template>
  <article class="ordre">
    <div class="ligne">
      <h3>{{ mission.titre }}</h3>
      <span class="tampon" :class="`tampon--${mission.statut}`">{{ NOMS_STATUT_MISSION[mission.statut] }}</span>
    </div>
    <p class="lieu">{{ nomIle }} · {{ mission.type === 'expedition' ? 'Expédition' : 'Ordre principal' }}</p>
    <p v-if="mission.accroche" class="accroche">{{ mission.accroche }}</p>
  </article>
</template>

<style scoped>
.ordre { border-top: 1px solid var(--trait); padding-top: 0.55rem; display: flex; flex-direction: column; gap: 0.15rem; }
.ligne { display: flex; justify-content: space-between; align-items: baseline; gap: 0.6rem; }
h3 { font-size: 1.1rem; }
.lieu { margin: 0; font-size: var(--t-s); color: var(--encre-2); }
.accroche { margin: 0; font-size: 0.95rem; }
</style>
