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
        <button v-for="f in filtres" :key="f.cle" type="button" class="bouton-laiton" :aria-pressed="filtre === f.cle" @click="filtre = f.cle">{{ f.nom }}</button>
      </div>
    </div>
    <p class="avertissement">Une expédition prend du temps. Le ciel, lui, n'attend pas.</p>
    <div class="billets">
      <MissionLigne v-for="m in visibles" :key="m.id" billet :mission="m" :nom-ile="nomsIles[m.ile]" />
    </div>
    <p v-if="!visibles.length" class="vide">Aucun ordre pour l'instant. Les rumeurs arrivent avec le vent.</p>
  </section>
</template>

<style scoped>
.ordres { display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }
.entete { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem; }
h2 { font-size: 1.8rem; color: var(--laiton-clair); text-shadow: 0 2px 2px rgba(0, 0, 0, 0.6); }
.avertissement, .vide { margin: 0; font-family: var(--f-titre); font-style: italic; color: #cdb48c; }
.filtres { display: flex; gap: 0.4rem; }
.bouton-laiton {
  border: 1px solid var(--laiton-sombre);
  border-radius: 999px;
  padding: 0.2rem 0.8rem;
  font-size: var(--t-s);
  color: var(--laiton-clair);
  background: rgba(0, 0, 0, 0.2);
}
.bouton-laiton[aria-pressed='true'] {
  color: #2a1a0c;
  background: linear-gradient(160deg, var(--laiton-clair), var(--laiton) 60%);
  font-weight: 700;
}
.billets { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 1.4rem; padding-top: 0.4rem; }
.billets > :nth-child(3n + 1) { transform: rotate(-1.2deg); }
.billets > :nth-child(3n + 2) { transform: rotate(0.8deg); }
.billets > :nth-child(3n) { transform: rotate(-0.4deg); }
</style>
