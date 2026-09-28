<script setup>
import { computed } from 'vue'
import { aleatoire, contour } from '../composables/formes.js'
import { largeurTexte, placerEtiquettes } from '../composables/placement.js'
import { formaterAltitude } from '../composables/format.js'

const props = defineProps({
  iles: { type: Array, required: true },
  selection: { type: String, default: null },
})
const emit = defineEmits(['choisir'])

const LARGEUR = 1000
const HAUTEUR = 640
const CENTRE = { x: 500, y: 330 }
const rayons = Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8)

const etiquettes = computed(() =>
  placerEtiquettes(
    [...props.iles]
      .sort((a, b) => a.y - b.y)
      .map((i) => ({ id: i.id, x: i.x, y: i.y + i.r + 22, largeur: largeurTexte(i.nom, 15, 0.62) + 12 })),
    { hauteur: 32, direction: 1 },
  ),
)

// Quelques bosquets dessinés à la plume sur chaque île.
function bosquets(ile) {
  const hasard = aleatoire(`${ile.id}-bosquets`)
  return Array.from({ length: Math.max(2, Math.round(ile.r / 7)) }, () => {
    const angle = hasard() * Math.PI * 2
    const d = hasard() * ile.r * 0.5
    return { x: ile.x + Math.cos(angle) * d * 1.1, y: ile.y + Math.sin(angle) * d * 0.8, r: 2 + hasard() * 2 }
  })
}

const grande = (ile) => ile.r >= 25

function surTouche(evenement, id) {
  if (evenement.key === 'Enter' || evenement.key === ' ') {
    evenement.preventDefault()
    emit('choisir', id)
  }
}
</script>

<template>
  <svg class="croquis" :viewBox="`0 0 ${LARGEUR} ${HAUTEUR}`" role="img" aria-labelledby="titre-plan">
    <title id="titre-plan">Plan du ciel d'Eldaria, vu de dessus</title>
    <defs>
      <radialGradient id="voile-brume" cx="0.5" cy="0.52" r="0.7">
        <stop offset="0.55" stop-color="#9486a8" stop-opacity="0" />
        <stop offset="1" stop-color="#62567a" stop-opacity="0.55" />
      </radialGradient>
      <filter id="aquarelle-plan" x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="12" />
        <feDisplacementMap in="SourceGraphic" scale="8" />
        <feGaussianBlur stdDeviation="0.8" />
      </filter>
      <filter id="plume-plan" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="5" />
        <feDisplacementMap in="SourceGraphic" scale="2" />
      </filter>
      <radialGradient id="laiton-rose" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#e6c983" />
        <stop offset="0.5" stop-color="#b8893a" />
        <stop offset="1" stop-color="#6c4b1c" />
      </radialGradient>
    </defs>

    <rect x="20" y="20" :width="LARGEUR - 40" :height="HAUTEUR - 40" fill="url(#voile-brume)" class="decor" />

    <g class="decor" aria-hidden="true">
      <rect x="14" y="14" :width="LARGEUR - 28" :height="HAUTEUR - 28" class="trait-fort" />
      <rect x="19" y="19" :width="LARGEUR - 38" :height="HAUTEUR - 38" class="trait-fin" />
      <line
        v-for="(a, i) in rayons"
        :key="i"
        class="rhumb"
        :x1="CENTRE.x"
        :y1="CENTRE.y"
        :x2="CENTRE.x + Math.cos(a) * 600"
        :y2="CENTRE.y + Math.sin(a) * 600"
      />
      <text x="500" y="44" text-anchor="middle" class="intitule">Plan des routes du ciel</text>
    </g>

    <g class="decor rose" transform="translate(880 150)" aria-hidden="true">
      <circle r="50" class="rose-cercle" />
      <circle r="42" class="rose-cercle" />
      <g v-for="a in [0, 90, 180, 270]" :key="a" :transform="`rotate(${a})`">
        <path d="M0 -62 L9 -9 L0 0 Z" fill="url(#laiton-rose)" class="rose-branche" />
        <path d="M0 -62 L-9 -9 L0 0 Z" class="rose-creux" />
      </g>
      <g v-for="a in [45, 135, 225, 315]" :key="a" :transform="`rotate(${a})`">
        <path d="M0 -38 L5 -5 L0 0 Z" fill="url(#laiton-rose)" class="rose-branche" />
        <path d="M0 -38 L-5 -5 L0 0 Z" class="rose-creux" />
      </g>
      <circle r="4" fill="url(#laiton-rose)" class="rose-branche" />
      <text y="-68" text-anchor="middle" class="nord">N</text>
    </g>

    <g class="decor echelle" transform="translate(52 590)" aria-hidden="true">
      <rect x="0" y="0" width="40" height="7" class="plein" />
      <rect x="40" y="0" width="40" height="7" class="vide" />
      <rect x="80" y="0" width="40" height="7" class="plein" />
      <rect x="120" y="0" width="40" height="7" class="vide" />
      <text x="0" y="-7" class="graduation">0</text>
      <text x="80" y="-7" text-anchor="middle" class="graduation">20</text>
      <text x="160" y="-7" text-anchor="middle" class="graduation">40 lieues</text>
    </g>

    <g
      v-for="ile in iles"
      :key="ile.id"
      class="ile"
      :class="`ile--${ile.statut}`"
      role="button"
      tabindex="0"
      :aria-label="`${ile.nom}, ${ile.statut === 'tombee' ? 'engloutie' : formaterAltitude(ile.alt)}`"
      :aria-pressed="ile.id === selection"
      @click="emit('choisir', ile.id)"
      @keydown="surTouche($event, ile.id)"
    >
      <template v-if="ile.statut !== 'tombee'">
        <path class="rivage" :d="contour(ile.id, ile.x, ile.y, ile.r, { echelle: 1.06 })" />
        <path class="terre" :d="contour(ile.id, ile.x, ile.y, ile.r, { echelle: 0.8 })" />
        <circle v-for="(b, k) in bosquets(ile)" :key="k" class="bosquet" :cx="b.x" :cy="b.y" :r="b.r" />
        <path class="contour" :d="contour(ile.id, ile.x, ile.y, ile.r, { echelle: 1.06 })" />
        <circle v-if="ile.statut === 'descend'" class="anneau" :cx="ile.x" :cy="ile.y" :r="ile.r * 1.5" />
      </template>
      <path v-else class="fantome" :d="contour(ile.id, ile.x, ile.y, ile.r)" />
      <ellipse v-if="ile.id === selection" class="entoure" :cx="ile.x" :cy="ile.y" :rx="ile.r * 1.8" :ry="ile.r * 1.45" />
      <circle class="zone-clic" :cx="ile.x" :cy="ile.y" :r="ile.r * 1.5" />
    </g>

    <g class="etiquettes" aria-hidden="true">
      <g v-for="ile in iles" :key="`e-${ile.id}`" :class="{ choisie: ile.id === selection }">
        <text :x="ile.x" :y="etiquettes[ile.id]" text-anchor="middle" :class="grande(ile) ? 'nom-majeur' : 'nom'">{{ ile.nom }}</text>
        <text v-if="ile.statut !== 'tombee'" :x="ile.x" :y="etiquettes[ile.id] + 15" text-anchor="middle" class="altitude">{{ formaterAltitude(ile.alt) }}</text>
        <g v-else :transform="`translate(${ile.x} ${ile.y}) rotate(-12)`">
          <rect x="-50" y="-12" width="100" height="22" rx="3" class="tampon-cadre" />
          <text y="4" text-anchor="middle" class="tampon-texte">ENGLOUTIE</text>
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.croquis { display: block; width: 100%; height: auto; }
.decor, .etiquettes { pointer-events: none; }
.trait-fort { fill: none; stroke: var(--encre); stroke-width: 1.3; }
.trait-fin { fill: none; stroke: var(--encre); stroke-width: 0.7; }
.rhumb { stroke: var(--encre-2); stroke-width: 0.5; opacity: 0.35; }
.intitule { font-family: var(--f-titre); font-style: italic; font-size: 17px; fill: var(--encre-2); letter-spacing: 0.04em; }
.rose-cercle { fill: rgba(238, 224, 192, 0.6); stroke: var(--encre); stroke-width: 0.8; }
.rose-branche { stroke: var(--encre); stroke-width: 0.7; }
.rose-creux { fill: var(--papier); stroke: var(--encre); stroke-width: 0.7; }
.nord { font-family: var(--f-titre); font-size: 18px; fill: var(--rouge); }
.plein { fill: var(--encre); }
.vide { fill: var(--papier); stroke: var(--encre); stroke-width: 0.8; }
.graduation { font-family: var(--f-cote); font-size: 11.5px; fill: var(--encre); }

.ile { cursor: pointer; outline: none; }
.rivage { fill: var(--lavis-ocre); filter: url(#aquarelle-plan); opacity: 0.85; }
.terre { fill: var(--lavis-vert); filter: url(#aquarelle-plan); opacity: 0.9; }
.bosquet { fill: var(--lavis-vert-sombre); stroke: var(--encre); stroke-width: 0.5; }
.contour { fill: none; stroke: var(--encre); stroke-width: 1.3; filter: url(#plume-plan); }
.ile--instable .contour { stroke-dasharray: 2 3; }
.anneau { fill: none; stroke: var(--ocre-alerte); stroke-width: 1.2; stroke-dasharray: 4 5; }
.fantome { fill: none; stroke: var(--rouge); stroke-width: 1.2; stroke-dasharray: 5 4; opacity: 0.7; }
.entoure { fill: none; stroke: var(--rouge); stroke-width: 1.8; filter: url(#plume-plan); }
.zone-clic { fill: transparent; }
.ile:hover .contour, .ile:focus-visible .contour { stroke-width: 2.2; }

.nom, .nom-majeur, .altitude { paint-order: stroke; stroke: var(--papier); stroke-width: 4px; stroke-linejoin: round; }
.nom { font-family: var(--f-titre); font-style: italic; font-size: 15px; fill: var(--encre); }
.nom-majeur { font-family: var(--f-titre); font-size: 16px; letter-spacing: 0.16em; text-transform: uppercase; fill: var(--encre); }
.altitude { font-family: var(--f-cote); font-size: 11px; fill: var(--encre-2); }
.choisie .nom, .choisie .nom-majeur { fill: var(--rouge); }
.tampon-cadre { fill: rgba(238, 224, 192, 0.7); stroke: var(--rouge); stroke-width: 2; }
.tampon-texte { font-family: var(--f-texte); font-weight: 700; font-size: 12.5px; letter-spacing: 0.22em; fill: var(--rouge); }
</style>
