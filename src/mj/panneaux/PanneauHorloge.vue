<script setup>
import { computed } from 'vue'
import { appliquerEvenement, changerHorloge } from '../../domain/index.js'

const props = defineProps({ etat: { type: Object, required: true } })
const emit = defineEmits(['agir'])

const max = computed(() => props.etat.regles.horloge.max)
const seuils = computed(() => new Set(props.etat.regles.seuils.map((s) => s.s)))

// Un cadran de segments, comme une horloge de progression.
const segments = computed(() =>
  Array.from({ length: max.value }, (_, i) => {
    const a0 = (i / max.value) * Math.PI * 2 - Math.PI / 2 + 0.035
    const a1 = ((i + 1) / max.value) * Math.PI * 2 - Math.PI / 2 - 0.035
    const p = (a, r) => `${(100 + Math.cos(a) * r).toFixed(2)} ${(100 + Math.sin(a) * r).toFixed(2)}`
    const am = (a0 + a1) / 2
    return {
      d: `M${p(a0, 86)} A86 86 0 0 1 ${p(a1, 86)} L${p(a1, 62)} A62 62 0 0 0 ${p(a0, 62)}Z`,
      rempli: i < props.etat.horloge,
      seuil: seuils.value.has(i + 1),
      repere: { x: 100 + Math.cos(am) * 94, y: 100 + Math.sin(am) * 94 },
    }
  }),
)

const avancer = (delta) => emit('agir', (e) => changerHorloge(e, delta, 'Ajustement manuel').etat)
const evenement = (index) => emit('agir', (e) => appliquerEvenement(e, index).etat)
</script>

<template>
  <div class="panneau">
    <div class="horloge">
      <svg viewBox="0 0 200 200" class="cadran" role="img" :aria-label="`Horloge d'Éveil : ${etat.horloge} sur ${max}`">
        <g v-for="(s, i) in segments" :key="i">
          <path :d="s.d" :class="s.rempli ? 'plein' : 'vide'" />
          <circle v-if="s.seuil" :cx="s.repere.x" :cy="s.repere.y" r="2.6" class="repere" />
        </g>
        <text x="100" y="110" text-anchor="middle" class="valeur">{{ etat.horloge }}</text>
        <text x="100" y="130" text-anchor="middle" class="sur">sur {{ max }}</text>
      </svg>
      <div class="infos">
        <p class="aide">Chaque changement recalcule les altitudes et la brume, fait tomber les îles qui touchent la brume et met à jour la carte des joueurs. Les points autour du cadran marquent les seuils.</p>
        <div class="pas">
          <button type="button" aria-label="Reculer l'Horloge d'un point" @click="avancer(-1)">−</button>
          <button type="button" aria-label="Avancer l'Horloge d'un point" @click="avancer(1)">+</button>
        </div>
      </div>
    </div>

    <div class="deux-colonnes">
      <div>
        <h3>Événements</h3>
        <ul class="evenements">
          <li v-for="(ev, i) in etat.regles.evenements" :key="ev.libelle">
            <button type="button" class="bouton evenement" @click="evenement(i)">
              <span>{{ ev.libelle }}</span>
              <span class="cote" :class="ev.delta > 0 ? 'hausse' : 'baisse'">{{ ev.delta > 0 ? '+' : '−' }}{{ Math.abs(ev.delta) }}</span>
            </button>
          </li>
        </ul>
      </div>
      <div>
        <h3>Seuils</h3>
        <ol class="seuils">
          <li v-for="s in etat.regles.seuils" :key="s.s" :class="{ atteint: etat.horloge >= s.s }">
            <span class="cote">{{ s.s }}</span>
            <span>{{ s.mj }}</span>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<style scoped>
.horloge { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: center; }
.cadran { width: 12rem; max-width: 100%; height: auto; }
.plein { fill: var(--encre); stroke: var(--papier); stroke-width: 1; }
.vide { fill: none; stroke: var(--encre-2); stroke-width: 1; }
.repere { fill: var(--rouge); }
.valeur { font-family: var(--f-cote); font-size: 34px; fill: var(--encre); }
.sur { font-family: var(--f-texte); font-style: italic; font-size: 12px; fill: var(--encre-2); }
.infos { flex: 1 1 16rem; display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
h3 { font-size: 1.2rem; margin-bottom: 0.5rem; }
.evenements { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.4rem; }
.evenement { width: 100%; display: flex; justify-content: space-between; gap: 0.5rem; text-align: left; }
.hausse { color: var(--ambre); font-weight: 600; }
.baisse { color: var(--vert); font-weight: 600; }
.seuils { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.seuils li { display: grid; grid-template-columns: 2rem minmax(0, 1fr); color: var(--encre-2); }
.seuils li.atteint { color: var(--encre); text-decoration: line-through; text-decoration-color: var(--rouge); }
</style>
