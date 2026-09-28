<script setup>
import { computed, ref } from 'vue'
import MissionLigne from './MissionLigne.vue'

const props = defineProps({
  missions: { type: Array, required: true },
  nomsIles: { type: Object, required: true },
})

const filtres = [
  { cle: 'toutes', nom: 'Tous' },
  { cle: 'principale', nom: 'Principaux' },
  { cle: 'expedition', nom: 'Expéditions' },
]
const filtre = ref('toutes')
const ORDRE = { en_cours: 0, disponible: 1, terminee: 2 }

const visibles = computed(() =>
  props.missions
    .filter((m) => filtre.value === 'toutes' || m.type === filtre.value)
    .sort((a, b) => (ORDRE[a.statut] ?? 3) - (ORDRE[b.statut] ?? 3)),
)
</script>

<template>
  <section class="ordres" aria-labelledby="titre-ordres">
    <div class="entete">
      <h2 id="titre-ordres">Ordres de mission</h2>
      <div class="filtres" role="group" aria-label="Filtrer les ordres">
        <button v-for="f in filtres" :key="f.cle" type="button" class="lien-bouton" :aria-pressed="filtre === f.cle" @click="filtre = f.cle">{{ f.nom }}</button>
      </div>
    </div>
    <p class="avertissement">Une expédition prend du temps. Le ciel, lui, n'attend pas.</p>
    <MissionLigne v-for="m in visibles" :key="m.id" :mission="m" :nom-ile="nomsIles[m.ile]" />
    <p v-if="!visibles.length" class="vide">Aucun ordre pour l'instant. Les rumeurs arrivent avec le vent.</p>
  </section>
</template>

<style scoped>
.ordres { display: flex; flex-direction: column; gap: 0.6rem; }
.entete { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
h2 { font-size: var(--t-l); }
.filtres { display: flex; gap: 0.9rem; font-size: var(--t-s); }
.avertissement { margin: 0; font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
.vide { margin: 0; color: var(--encre-2); }
</style>
