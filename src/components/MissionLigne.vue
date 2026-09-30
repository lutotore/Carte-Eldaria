<script setup>
import { NOMS_STATUT_MISSION } from '../composables/format.js'

defineProps({
  mission: { type: Object, required: true },
  nomIle: { type: String, default: 'Lieu inconnu' },
  billet: { type: Boolean, default: false },
})
</script>

<template>
  <article class="ordre" :class="{ 'ordre--billet papier': billet }">
    <div class="ligne">
      <h3>{{ mission.titre }}</h3>
      <span class="tampon" :class="`tampon--${mission.statut}`">{{ NOMS_STATUT_MISSION[mission.statut] }}</span>
    </div>
    <p class="lieu">{{ nomIle }} · {{ mission.type === 'expedition' ? 'Expédition' : 'Ordre principal' }}</p>
    <p v-if="mission.accroche" class="accroche">{{ mission.accroche }}</p>
  </article>
</template>

<style scoped>
.ordre { display: flex; flex-direction: column; gap: 0.1rem; }
.ligne { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; }
h3 { font-size: 1.15rem; line-height: 1.25; }
.lieu { margin: 0; font-size: var(--t-s); color: var(--encre-2); }
.accroche { margin: 0; font-size: 0.95rem; line-height: 1.4; }

/* Billet épinglé au tableau des ordres. */
.ordre--billet { padding: 1.6rem 1rem 1rem; gap: 0.3rem; }
.ordre--billet::before {
  content: '';
  position: absolute;
  top: 8px;
  left: 50%;
  width: 13px;
  height: 13px;
  margin-left: -6.5px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--laiton-clair), var(--laiton) 45%, var(--laiton-sombre));
  box-shadow: 1px 2px 3px rgba(0, 0, 0, 0.55);
}
</style>
