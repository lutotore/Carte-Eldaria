<script setup>
import { computed } from 'vue'
import { dessous } from '../composables/formes.js'
import { largeurTexte, placerEtiquettes } from '../composables/placement.js'
import { formaterAltitude, ecartDernierReleve } from '../composables/format.js'

const props = defineProps({
  iles: { type: Array, required: true },
  brume: { type: Number, required: true },
  selection: { type: String, default: null },
})
const emit = defineEmits(['choisir'])

const LARGEUR = 1000
const HAUTEUR = 560
const ALT_MIN = 1100
// Le haut de l'échelle suit l'île la plus haute visible, pour ne pas laisser la planche vide.
const ALT_PLAFOND = 3450
const BAS = 500
const HAUT = 60
const MARGE_GAUCHE = 120
const MARGE_DROITE = 950

const altMax = computed(() => {
  const plusHaute = Math.max(0, ...props.iles.map((i) => i.alt ?? 0))
  return Math.min(ALT_PLAFOND, Math.max(2600, Math.ceil((plusHaute + 400) / 100) * 100))
})
const yAltitude = (alt) => BAS - ((Math.min(altMax.value, Math.max(ALT_MIN, alt)) - ALT_MIN) / (altMax.value - ALT_MIN)) * (BAS - HAUT)
const yBrume = computed(() => yAltitude(props.brume))

const graduations = computed(() => {
  const liste = []
  for (let alt = 1200; alt <= altMax.value - 100; alt += 100) liste.push({ alt, y: yAltitude(alt), majeure: alt % 500 === 0 })
  return liste
})

// En élévation, les îles gardent leur ordre ouest → est mais sont espacées régulièrement.
const volantes = computed(() => {
  const liste = props.iles.filter((i) => i.statut !== 'tombee').sort((a, b) => a.x - b.x)
  const pas = liste.length > 1 ? (MARGE_DROITE - MARGE_GAUCHE) / (liste.length - 1) : 0
  return liste.map((ile, i) => {
    const cx = liste.length > 1 ? MARGE_GAUCHE + i * pas : (MARGE_GAUCHE + MARGE_DROITE) / 2
    const haut = yAltitude(ile.alt ?? 2000)
    const r = Math.min(ile.r, 26)
    return { ...ile, cx, haut, largeur: r * 2.4, profondeur: r * 1.6, ecart: ecartDernierReleve(ile) }
  })
})

const etiquettes = computed(() =>
  placerEtiquettes(
    volantes.value.map((i) => ({ id: i.id, x: i.cx, y: i.haut - 20, largeur: Math.max(largeurTexte(i.nom, 15), 70) + 10 })),
    { hauteur: 32 },
  ),
)

const englouties = computed(() => props.iles.filter((i) => i.statut === 'tombee'))

function stalactites(ile) {
  return [-1, 0, 1].map((k) => {
    const x = ile.cx + (k * ile.largeur) / 5
    const y = ile.haut + ile.profondeur * 0.62
    return `M${x - 3} ${y} L${x} ${y + ile.profondeur * 0.45} L${x + 3} ${y}`
  })
}

function surTouche(evenement, id) {
  if (evenement.key === 'Enter' || evenement.key === ' ') {
    evenement.preventDefault()
    emit('choisir', id)
  }
}
</script>

<template>
  <svg class="planche" :viewBox="`0 0 ${LARGEUR} ${HAUTEUR}`" role="img" aria-labelledby="titre-elevation">
    <title id="titre-elevation">Élévation des îles relevées au-dessus de la mer de brume</title>
    <defs>
      <pattern id="hachures" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
        <line class="hachure" x1="0" y1="0" x2="0" y2="5" />
      </pattern>
      <pattern id="vagues" width="48" height="12" patternUnits="userSpaceOnUse">
        <path class="vague" d="M0 6 Q12 1 24 6 T48 6" />
      </pattern>
      <filter id="trace-main" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
        <feDisplacementMap in="SourceGraphic" scale="2.4" />
      </filter>
    </defs>

    <g class="echelle" aria-hidden="true">
      <line :x1="60" :x2="60" :y1="HAUT - 10" :y2="BAS" class="axe" />
      <template v-for="g in graduations" :key="g.alt">
        <line :x1="g.majeure ? 50 : 55" :x2="60" :y1="g.y" :y2="g.y" class="axe" />
        <line v-if="g.majeure" x1="64" :x2="LARGEUR - 24" :y1="g.y" :y2="g.y" class="repere" />
        <text v-if="g.majeure" x="46" :y="g.y + 4" text-anchor="end" class="cote-echelle">{{ g.alt }}</text>
      </template>
      <text x="22" :y="HAUT - 22" class="unite">mètres</text>
    </g>

    <g filter="url(#trace-main)">
      <g
        v-for="ile in volantes"
        :key="ile.id"
        class="ile"
        :class="{ 'ile--choisie': ile.id === selection }"
        role="button"
        tabindex="0"
        :aria-label="`${ile.nom}, ${formaterAltitude(ile.alt)}`"
        :aria-pressed="ile.id === selection"
        @click="emit('choisir', ile.id)"
        @keydown="surTouche($event, ile.id)"
      >
        <path class="roche" :d="dessous(ile.id, ile.cx, ile.haut, ile.largeur, ile.profondeur)" />
        <line class="sol" :x1="ile.cx - ile.largeur / 2 - 2" :x2="ile.cx + ile.largeur / 2 + 2" :y1="ile.haut" :y2="ile.haut" />
        <path v-for="(d, k) in ile.statut === 'descend' ? stalactites(ile) : []" :key="k" class="stalactite" :d="d" />
        <rect class="zone-clic" :x="ile.cx - ile.largeur / 2 - 6" :y="ile.haut - 14" :width="ile.largeur + 12" :height="ile.profondeur + 22" />
      </g>
    </g>

    <g aria-hidden="true">
      <g v-for="ile in volantes" :key="`e-${ile.id}`" class="etiquette" :class="{ 'etiquette--choisie': ile.id === selection }">
        <line v-if="etiquettes[ile.id] < ile.haut - 24" class="renvoi" :x1="ile.cx" :x2="ile.cx" :y1="etiquettes[ile.id] + 6" :y2="ile.haut - 6" />
        <text :x="ile.cx" :y="etiquettes[ile.id] - 12" text-anchor="middle" class="nom">{{ ile.nom }}</text>
        <text :x="ile.cx" :y="etiquettes[ile.id] + 3" text-anchor="middle" class="altitude">
          {{ formaterAltitude(ile.alt) }}<tspan v-if="ile.ecart" class="ecart" dx="4">▼{{ Math.abs(ile.ecart) }}</tspan>
        </text>
      </g>
    </g>

    <g class="brume" aria-hidden="true">
      <rect x="0" :y="yBrume" :width="LARGEUR" :height="HAUTEUR - yBrume" class="lavis" />
      <rect x="0" :y="yBrume" :width="LARGEUR" :height="HAUTEUR - yBrume" fill="url(#vagues)" />
      <path class="bord-brume" :d="`M0 ${yBrume} Q 60 ${yBrume - 6} 120 ${yBrume} T 240 ${yBrume} T 360 ${yBrume} T 480 ${yBrume} T 600 ${yBrume} T 720 ${yBrume} T 840 ${yBrume} T 960 ${yBrume} T 1080 ${yBrume}`" />
      <text x="72" :y="Math.min(HAUTEUR - 16, yBrume + 24)" class="legende-brume">Mer de brume</text>
      <text x="72" :y="Math.min(HAUTEUR - 2, yBrume + 40)" class="cote-brume">{{ formaterAltitude(brume) }}</text>
      <text
        v-for="(ile, i) in englouties"
        :key="ile.id"
        :x="LARGEUR - 40"
        :y="Math.min(HAUTEUR - 12, yBrume + 26 + i * 18)"
        text-anchor="end"
        class="engloutie"
      >✕ {{ ile.nom }}, engloutie</text>
    </g>
  </svg>
</template>

<style scoped>
.planche { display: block; width: 100%; height: auto; }
/* La brume et les étiquettes ne doivent jamais masquer le clic sur une île. */
.brume, .etiquette { pointer-events: none; }
.axe { stroke: var(--encre); stroke-width: 1; }
.repere { stroke: var(--trait); stroke-width: 0.8; stroke-dasharray: 1 5; }
.cote-echelle, .cote-brume, .altitude { font-family: var(--f-cote); font-size: 11.5px; fill: var(--encre-2); }
.unite { font-family: var(--f-texte); font-style: italic; font-size: 12px; fill: var(--encre-2); }
.hachure { stroke: var(--encre-2); stroke-width: 0.7; }
.vague { fill: none; stroke: var(--encre-2); stroke-width: 0.8; opacity: 0.55; }
.lavis { fill: var(--lavis); opacity: 0.85; }
.bord-brume { fill: none; stroke: var(--encre); stroke-width: 1.4; }
.legende-brume { font-family: var(--f-titre); font-style: italic; font-size: 16px; fill: var(--encre); }
.engloutie { font-family: var(--f-titre); font-style: italic; font-size: 14px; fill: var(--rouge); }

.ile { cursor: pointer; outline: none; }
.roche { fill: url(#hachures); stroke: var(--encre); stroke-width: 1.2; }
.sol { stroke: var(--encre); stroke-width: 2.4; stroke-linecap: round; }
.stalactite { fill: none; stroke: var(--ambre); stroke-width: 1.2; }
.zone-clic { fill: transparent; }
.ile:hover .roche, .ile:focus-visible .roche { stroke-width: 2; }
.ile--choisie .roche { stroke: var(--rouge); stroke-width: 2.2; }
.ile--choisie .sol { stroke: var(--rouge); }

.nom { font-family: var(--f-titre); font-style: italic; font-size: 15px; fill: var(--encre); paint-order: stroke; stroke: var(--papier); stroke-width: 4px; stroke-linejoin: round; }
.altitude { paint-order: stroke; stroke: var(--papier); stroke-width: 4px; }
.ecart { fill: var(--ambre); }
.renvoi { stroke: var(--encre-2); stroke-width: 0.7; }
.etiquette--choisie .nom { fill: var(--rouge); }
</style>
