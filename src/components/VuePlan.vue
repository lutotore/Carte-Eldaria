<script setup>
import { computed } from 'vue'
import { contour } from '../composables/formes.js'
import { largeurTexte, placerEtiquettes } from '../composables/placement.js'
import { formaterAltitude } from '../composables/format.js'

const props = defineProps({
  iles: { type: Array, required: true },
  selection: { type: String, default: null },
})
const emit = defineEmits(['choisir'])

const LARGEUR = 1000
const HAUTEUR = 640
const CENTRE = { x: 500, y: 320 }

const cercles = [90, 180, 270, 360]
const rayons = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6)

const etiquettes = computed(() =>
  placerEtiquettes(
    [...props.iles]
      .sort((a, b) => a.y - b.y)
      .map((i) => ({ id: i.id, x: i.x, y: i.y + i.r + 20, largeur: largeurTexte(i.nom, 14, 0.62) + 12 })),
    { hauteur: 30, direction: 1 },
  ),
)

const grande = (ile) => ile.r >= 25

function surTouche(evenement, id) {
  if (evenement.key === 'Enter' || evenement.key === ' ') {
    evenement.preventDefault()
    emit('choisir', id)
  }
}
</script>

<template>
  <svg class="planche" :viewBox="`0 0 ${LARGEUR} ${HAUTEUR}`" role="img" aria-labelledby="titre-plan">
    <title id="titre-plan">Plan du ciel d'Eldaria, vu de dessus</title>
    <defs>
      <filter id="trace-plan" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="11" />
        <feDisplacementMap in="SourceGraphic" scale="2" />
      </filter>
    </defs>

    <g class="canevas" aria-hidden="true">
      <circle v-for="r in cercles" :key="r" :cx="CENTRE.x" :cy="CENTRE.y" :r="r" />
      <line
        v-for="(a, i) in rayons"
        :key="i"
        :x1="CENTRE.x + Math.cos(a) * 40"
        :y1="CENTRE.y + Math.sin(a) * 40"
        :x2="CENTRE.x + Math.cos(a) * 420"
        :y2="CENTRE.y + Math.sin(a) * 420"
      />
    </g>

    <g class="rose" transform="translate(912 92)" aria-hidden="true">
      <circle r="44" class="rose-cercle" />
      <circle r="36" class="rose-cercle" />
      <path d="M0 -52 L7 -7 L0 0 Z" class="plein" />
      <path d="M0 -52 L-7 -7 L0 0 Z" class="vide" />
      <path d="M0 52 L-7 7 L0 0 Z" class="plein" />
      <path d="M0 52 L7 7 L0 0 Z" class="vide" />
      <path d="M52 0 L7 7 L0 0 Z" class="plein" />
      <path d="M52 0 L7 -7 L0 0 Z" class="vide" />
      <path d="M-52 0 L-7 -7 L0 0 Z" class="plein" />
      <path d="M-52 0 L-7 7 L0 0 Z" class="vide" />
      <text y="-58" text-anchor="middle" class="nord">N</text>
    </g>

    <g class="echelle-plan" transform="translate(40 604)" aria-hidden="true">
      <rect x="0" y="0" width="40" height="6" class="plein" />
      <rect x="40" y="0" width="40" height="6" class="vide" />
      <rect x="80" y="0" width="40" height="6" class="plein" />
      <rect x="120" y="0" width="40" height="6" class="vide" />
      <text x="0" y="-6" class="graduation">0</text>
      <text x="80" y="-6" text-anchor="middle" class="graduation">20</text>
      <text x="160" y="-6" text-anchor="middle" class="graduation">40 lieues</text>
    </g>

    <g filter="url(#trace-plan)">
      <g
        v-for="ile in iles"
        :key="ile.id"
        class="ile"
        :class="[`ile--${ile.statut}`, { 'ile--choisie': ile.id === selection }]"
        role="button"
        tabindex="0"
        :aria-label="`${ile.nom}, ${ile.statut === 'tombee' ? 'engloutie' : formaterAltitude(ile.alt)}`"
        :aria-pressed="ile.id === selection"
        @click="emit('choisir', ile.id)"
        @keydown="surTouche($event, ile.id)"
      >
        <circle v-if="ile.statut === 'descend'" class="anneau" :cx="ile.x" :cy="ile.y" :r="ile.r * 1.45" />
        <path class="terre" :d="contour(ile.id, ile.x, ile.y, ile.r)" />
        <path v-if="ile.statut !== 'tombee'" class="courbe" :d="contour(ile.id, ile.x, ile.y, ile.r, { echelle: 0.58 })" />
        <path v-if="ile.statut !== 'tombee' && ile.r > 18" class="courbe" :d="contour(ile.id, ile.x, ile.y, ile.r, { echelle: 0.28 })" />
      </g>
    </g>

    <g aria-hidden="true" class="etiquettes">
      <g v-for="ile in iles" :key="`e-${ile.id}`" :class="{ 'etiquette--choisie': ile.id === selection }">
        <text :x="ile.x" :y="etiquettes[ile.id]" text-anchor="middle" :class="grande(ile) ? 'nom-majeur' : 'nom'">{{ ile.nom }}</text>
        <text v-if="ile.statut !== 'tombee'" :x="ile.x" :y="etiquettes[ile.id] + 14" text-anchor="middle" class="altitude">{{ formaterAltitude(ile.alt) }}</text>
        <g v-else :transform="`translate(${ile.x} ${ile.y}) rotate(-12)`">
          <rect x="-44" y="-11" width="88" height="20" class="tampon-cadre" />
          <text y="4" text-anchor="middle" class="tampon-texte">ENGLOUTIE</text>
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.planche { display: block; width: 100%; height: auto; }
.etiquettes, .canevas, .rose, .echelle-plan { pointer-events: none; }
.canevas circle, .canevas line { fill: none; stroke: var(--trait); stroke-width: 0.8; stroke-dasharray: 2 6; }
.rose-cercle { fill: none; stroke: var(--encre-2); stroke-width: 0.8; }
.plein { fill: var(--encre); }
.vide { fill: var(--papier); stroke: var(--encre); stroke-width: 0.8; }
.nord, .graduation { font-family: var(--f-cote); font-size: 12px; fill: var(--encre); }

.ile { cursor: pointer; outline: none; }
.terre { fill: var(--lavis); stroke: var(--encre); stroke-width: 1.4; }
.courbe { fill: none; stroke: var(--encre-2); stroke-width: 0.8; }
.anneau { fill: none; stroke: var(--ambre); stroke-width: 1.2; stroke-dasharray: 3 5; }
.ile--instable .terre { stroke-dasharray: 1 3; }
.ile--tombee .terre { fill: none; stroke: var(--rouge); stroke-dasharray: 5 4; }
.ile:hover .terre, .ile:focus-visible .terre { stroke-width: 2.2; }
.ile--choisie .terre { stroke: var(--rouge); stroke-width: 2.4; }

.nom, .nom-majeur, .altitude { paint-order: stroke; stroke: var(--papier); stroke-width: 4px; stroke-linejoin: round; }
.nom { font-family: var(--f-titre); font-style: italic; font-size: 14px; fill: var(--encre); }
.nom-majeur { font-family: var(--f-titre); font-size: 15px; letter-spacing: 0.18em; text-transform: uppercase; fill: var(--encre); }
.altitude { font-family: var(--f-cote); font-size: 11px; fill: var(--encre-2); }
.etiquette--choisie .nom, .etiquette--choisie .nom-majeur { fill: var(--rouge); }
.tampon-cadre { fill: none; stroke: var(--rouge); stroke-width: 1.8; }
.tampon-texte { font-family: var(--f-texte); font-weight: 700; font-size: 12px; letter-spacing: 0.2em; fill: var(--rouge); }
</style>
