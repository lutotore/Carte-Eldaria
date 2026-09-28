<script setup>
import { computed } from 'vue'
import { appliquerEvenement, changerHorloge } from '../../domain/index.js'

const props = defineProps({ etat: { type: Object, required: true } })
const emit = defineEmits(['agir'])

// Le cadran couvre 270°, de -225° (valeur 0) à +45° (valeur max), aiguille comprise.
const DEBUT = -225
const OUVERTURE = 270
const max = computed(() => props.etat.regles.horloge.max)
const angle = (valeur) => DEBUT + (valeur / max.value) * OUVERTURE
const point = (deg, r) => {
  const a = (deg * Math.PI) / 180
  return { x: 120 + Math.cos(a) * r, y: 120 + Math.sin(a) * r }
}

function arc(de, a, r) {
  const p0 = point(angle(de), r)
  const p1 = point(angle(a), r)
  const grand = angle(a) - angle(de) > 180 ? 1 : 0
  return `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A${r} ${r} 0 ${grand} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
}

// Zones colorées du cadran : calme, inquiétude, danger (d'après les seuils des règles).
const zones = computed(() => {
  const s = props.etat.regles.seuils.map((x) => x.s)
  const inquietude = s.find((v) => v >= 10) ?? Math.round(max.value * 0.6)
  const danger = s.find((v) => v >= 16) ?? Math.round(max.value * 0.85)
  return [
    { d: arc(0, inquietude, 88), classe: 'zone-calme' },
    { d: arc(inquietude, danger, 88), classe: 'zone-inquietude' },
    { d: arc(danger, max.value, 88), classe: 'zone-danger' },
  ]
})

const graduations = computed(() =>
  Array.from({ length: max.value + 1 }, (_, v) => {
    const a = angle(v)
    const majeure = v % 5 === 0
    return { v, majeure, de: point(a, majeure ? 70 : 76), a: point(a, 82), texte: point(a, 58) }
  }),
)
const seuils = computed(() => props.etat.regles.seuils.map((s) => ({ s: s.s, p: point(angle(s.s), 97) })))
const aiguille = computed(() => angle(props.etat.horloge) + 90)

const avancer = (delta) => emit('agir', (e) => changerHorloge(e, delta, 'Ajustement manuel').etat)
const evenement = (index) => emit('agir', (e) => appliquerEvenement(e, index).etat)
</script>

<template>
  <div class="panneau">
    <div class="horloge">
      <svg viewBox="0 0 240 240" class="cadran" role="img" :aria-label="`Horloge d'Éveil : ${etat.horloge} sur ${max}`">
        <defs>
          <radialGradient id="bague" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0" stop-color="#f3dc9e" />
            <stop offset="0.45" stop-color="#b8893a" />
            <stop offset="0.8" stop-color="#7a5522" />
            <stop offset="1" stop-color="#4d3310" />
          </radialGradient>
          <radialGradient id="face" cx="0.45" cy="0.4" r="0.7">
            <stop offset="0" stop-color="#f6ecd4" />
            <stop offset="1" stop-color="#d9c396" />
          </radialGradient>
        </defs>
        <circle cx="120" cy="120" r="116" fill="url(#bague)" />
        <circle cx="120" cy="120" r="102" fill="url(#face)" stroke="#4d3310" stroke-width="1.5" />
        <path v-for="z in zones" :key="z.classe" :d="z.d" :class="z.classe" />
        <line v-for="g in graduations" :key="g.v" :x1="g.de.x" :y1="g.de.y" :x2="g.a.x" :y2="g.a.y" :class="g.majeure ? 'grad-majeure' : 'grad'" />
        <text v-for="g in graduations.filter((x) => x.majeure)" :key="`t${g.v}`" :x="g.texte.x" :y="g.texte.y + 4" text-anchor="middle" class="chiffre">{{ g.v }}</text>
        <circle v-for="s in seuils" :key="s.s" :cx="s.p.x" :cy="s.p.y" r="3" class="seuil" />
        <text x="120" y="160" text-anchor="middle" class="legende-cadran">Éveil</text>
        <g :transform="`rotate(${aiguille} 120 120)`" class="aiguille">
          <path d="M120 38 L125 120 L120 138 L115 120 Z" />
        </g>
        <circle cx="120" cy="120" r="8" fill="url(#bague)" stroke="#4d3310" />
      </svg>
      <div class="infos">
        <p class="valeur"><span class="cote">{{ etat.horloge }}</span> <span class="sur">sur {{ max }}</span></p>
        <p class="aide">Chaque changement recalcule les altitudes et la brume, fait tomber les îles qui touchent la brume et met à jour la carte des joueurs. Les points rouges marquent les seuils.</p>
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
            <button type="button" class="evenement" @click="evenement(i)">
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
.horloge { display: flex; flex-wrap: wrap; gap: 2rem; align-items: center; }
.cadran { width: 15rem; max-width: 100%; height: auto; filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.35)); }
.zone-calme, .zone-inquietude, .zone-danger { fill: none; stroke-width: 8; }
.zone-calme { stroke: #7f9a6a; }
.zone-inquietude { stroke: #c98f3c; }
.zone-danger { stroke: #a1392c; }
.grad { stroke: #3a2716; stroke-width: 1; }
.grad-majeure { stroke: #2a1a0c; stroke-width: 2; }
.chiffre { font-family: var(--f-titre); font-size: 15px; fill: #2a1a0c; }
.seuil { fill: var(--rouge); stroke: #f6ecd4; stroke-width: 1; }
.legende-cadran { font-family: var(--f-titre); font-style: italic; font-size: 15px; fill: #5a3d16; }
.aiguille path { fill: #2a1a0c; }
@media (prefers-reduced-motion: no-preference) {
  .aiguille { transition: transform 0.6s cubic-bezier(0.3, 1.4, 0.5, 1); }
}
.infos { flex: 1 1 16rem; display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
.valeur { margin: 0; font-size: 3rem; line-height: 1; }
.sur { font-family: var(--f-titre); font-style: italic; font-size: 1.1rem; color: var(--encre-2); }
.evenements { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.5rem; }
.evenement {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  text-align: left;
  padding: 0.45rem 0.7rem;
  border: 1px solid rgba(45, 31, 21, 0.35);
  border-radius: 3px;
  background: rgba(255, 250, 235, 0.5);
  color: var(--encre);
}
.evenement:hover { border-color: var(--rouge); }
.hausse { color: var(--rouge); font-weight: 600; }
.baisse { color: var(--vert); font-weight: 600; }
.seuils { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.seuils li { display: grid; grid-template-columns: 2rem minmax(0, 1fr); color: var(--encre-2); }
.seuils li.atteint { color: var(--encre); text-decoration: line-through; text-decoration-color: var(--rouge); }
</style>
