<script setup>
import { computed } from 'vue'
import { dessous } from '../composables/formes.js'
import { croquisIle, nuagesBrume } from '../composables/croquis.js'
import { largeurTexte, placerEtiquettes } from '../composables/placement.js'
import { formaterAltitude, ecartDernierReleve } from '../composables/format.js'

const props = defineProps({
  iles: { type: Array, required: true },
  brume: { type: Number, required: true },
  selection: { type: String, default: null },
})
const emit = defineEmits(['choisir'])

const LARGEUR = 1000
const HAUTEUR = 580
const ALT_MIN = 1100
const ALT_PLAFOND = 3450
const BAS = 505
const HAUT = 70
const MARGE_GAUCHE = 140
const MARGE_DROITE = 930

// Le haut de l'échelle suit l'île la plus haute visible, pour ne pas laisser la feuille vide.
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

// Les îles gardent leur ordre ouest → est mais sont espacées régulièrement.
const volantes = computed(() => {
  const liste = props.iles.filter((i) => i.statut !== 'tombee').sort((a, b) => a.x - b.x)
  const pas = liste.length > 1 ? (MARGE_DROITE - MARGE_GAUCHE) / (liste.length - 1) : 0
  return liste.map((ile, i) => {
    const cx = liste.length > 1 ? MARGE_GAUCHE + i * pas : (MARGE_GAUCHE + MARGE_DROITE) / 2
    const haut = yAltitude(ile.alt ?? 2000)
    // Les îles grossissent tant qu'elles ne se touchent pas.
    const r = Math.min(ile.r * 1.2, 32, pas ? pas / 3.4 : 32)
    const forme = { cx, haut, largeur: r * 2.8, profondeur: r * 1.8, r }
    return { ...ile, ...forme, croquis: croquisIle(ile.id, forme), ecart: ecartDernierReleve(ile) }
  })
})

const etiquettes = computed(() =>
  placerEtiquettes(
    volantes.value.map((i) => ({ id: i.id, x: i.cx, y: i.haut - i.r * 0.45 - 20, largeur: Math.max(largeurTexte(i.nom, 16), 74) + 10 })),
    { hauteur: 34 },
  ),
)

const nuages = computed(() => nuagesBrume(yBrume.value, LARGEUR))
const englouties = computed(() => props.iles.filter((i) => i.statut === 'tombee'))

function surTouche(evenement, id) {
  if (evenement.key === 'Enter' || evenement.key === ' ') {
    evenement.preventDefault()
    emit('choisir', id)
  }
}
</script>

<template>
  <svg class="croquis" :viewBox="`0 0 ${LARGEUR} ${HAUTEUR}`" role="img" aria-labelledby="titre-elevation">
    <title id="titre-elevation">Élévation des îles relevées au-dessus de la mer de brume</title>
    <defs>
      <linearGradient id="roche" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#b9a68c" />
        <stop offset="1" stop-color="#6f5d4b" />
      </linearGradient>
      <radialGradient id="lueur">
        <stop offset="0" stop-color="#9fd6ea" stop-opacity="0.9" />
        <stop offset="1" stop-color="#3f86ab" stop-opacity="0" />
      </radialGradient>
      <pattern id="hachures-sepia" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
        <line x1="0" y1="0" x2="0" y2="4" stroke="#2d1f15" stroke-width="0.7" stroke-opacity="0.55" />
      </pattern>
      <filter id="aquarelle" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" />
        <feDisplacementMap in="SourceGraphic" scale="7" />
        <feGaussianBlur stdDeviation="0.6" />
      </filter>
      <filter id="plume" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="9" />
        <feDisplacementMap in="SourceGraphic" scale="1.8" />
      </filter>
      <filter id="flou-nuage" x="-30%" y="-60%" width="160%" height="220%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <clipPath v-for="ile in volantes" :id="`ombre-${ile.id}`" :key="`c-${ile.id}`">
        <rect :x="ile.cx + ile.largeur * 0.05" :y="ile.haut" :width="ile.largeur" :height="ile.profondeur * 1.4" />
      </clipPath>
    </defs>

    <g class="cadre" aria-hidden="true">
      <rect x="14" y="14" :width="LARGEUR - 28" :height="HAUTEUR - 28" class="trait-fort" />
      <rect x="19" y="19" :width="LARGEUR - 38" :height="HAUTEUR - 38" class="trait-fin" />
      <text x="500" y="44" text-anchor="middle" class="intitule">Élévation des îles relevées</text>
    </g>

    <g class="regle" aria-hidden="true">
      <line x1="66" x2="66" :y1="HAUT - 6" :y2="BAS + 8" class="trait-fort" />
      <template v-for="g in graduations" :key="g.alt">
        <line :x1="g.majeure ? 54 : 60" x2="66" :y1="g.y" :y2="g.y" class="trait-fin" />
        <line v-if="g.majeure" x1="72" :x2="LARGEUR - 30" :y1="g.y" :y2="g.y" class="repere" />
        <text v-if="g.majeure" x="50" :y="g.y + 4" text-anchor="end" class="cote-regle">{{ g.alt }}</text>
      </template>
      <text x="36" :y="HAUT - 14" class="unite">m</text>
    </g>

    <g
      v-for="ile in volantes"
      :key="ile.id"
      class="ile"
      role="button"
      tabindex="0"
      :aria-label="`${ile.nom}, ${formaterAltitude(ile.alt)}`"
      :aria-pressed="ile.id === selection"
      @click="emit('choisir', ile.id)"
      @keydown="surTouche($event, ile.id)"
    >
      <ellipse class="lueur" :cx="ile.cx" :cy="ile.haut + ile.profondeur * 0.75" :rx="ile.largeur * 0.4" :ry="ile.profondeur * 0.55" />
      <path class="roche-lavis" :d="dessous(ile.id, ile.cx, ile.haut, ile.largeur, ile.profondeur)" />
      <path class="roche-ombre" :d="dessous(ile.id, ile.cx, ile.haut, ile.largeur, ile.profondeur)" :clip-path="`url(#ombre-${ile.id})`" />
      <path class="roche-trait" :d="dessous(ile.id, ile.cx, ile.haut, ile.largeur, ile.profondeur)" />
      <path
        v-for="(c, k) in ile.croquis.cristaux"
        :key="`k${k}`"
        class="cristal"
        :d="`M${c.x - 3} ${c.y} L${c.x} ${c.y + c.long} L${c.x + 3} ${c.y} Z`"
      />
      <path class="dome" :d="ile.croquis.dome" />
      <g v-for="(t, k) in ile.croquis.tours" :key="`t${k}`" class="tour">
        <rect :x="t.x - 3" :y="t.base - t.h" width="6" :height="t.h" />
        <path :d="`M${t.x - 4.5} ${t.base - t.h} L${t.x} ${t.base - t.h - 7} L${t.x + 4.5} ${t.base - t.h} Z`" class="toit" />
      </g>
      <g v-for="(a, k) in ile.croquis.arbres" :key="`a${k}`" class="arbre">
        <line :x1="a.x" :x2="a.x" :y1="a.y" :y2="a.y + a.rayon + 1" />
        <circle :cx="a.x" :cy="a.y" :r="a.rayon" />
      </g>
      <ellipse
        v-if="ile.id === selection"
        class="entoure"
        :cx="ile.cx"
        :cy="ile.haut + ile.profondeur * 0.25"
        :rx="ile.largeur * 0.78"
        :ry="ile.profondeur * 0.95 + 8"
      />
      <rect class="zone-clic" :x="ile.cx - ile.largeur / 2 - 8" :y="ile.haut - ile.r * 0.6 - 14" :width="ile.largeur + 16" :height="ile.profondeur + ile.r * 0.6 + 30" />
    </g>

    <g class="etiquettes" aria-hidden="true">
      <g v-for="ile in volantes" :key="`e-${ile.id}`" :class="{ choisie: ile.id === selection }">
        <line v-if="etiquettes[ile.id] < ile.haut - ile.r * 0.45 - 26" class="renvoi" :x1="ile.cx" :x2="ile.cx" :y1="etiquettes[ile.id] + 7" :y2="ile.haut - ile.r * 0.4 - 6" />
        <text :x="ile.cx" :y="etiquettes[ile.id] - 12" text-anchor="middle" class="nom">{{ ile.nom }}</text>
        <text :x="ile.cx" :y="etiquettes[ile.id] + 4" text-anchor="middle" class="altitude">
          {{ formaterAltitude(ile.alt) }}<tspan v-if="ile.ecart" class="ecart" dx="5">▼ {{ Math.abs(ile.ecart) }}</tspan>
        </text>
      </g>
    </g>

    <g class="brume" aria-hidden="true">
      <rect x="20" :y="yBrume + 4" :width="LARGEUR - 40" :height="HAUTEUR - yBrume - 24" class="brume-fond" />
      <g class="derive">
        <ellipse v-for="(n, i) in nuages" :key="i" :cx="n.cx" :cy="n.cy" :rx="n.rx" :ry="n.ry" :class="`nuage nuage-${n.rang}`" />
      </g>
      <path class="bord-brume" :d="`M22 ${yBrume} Q 80 ${yBrume - 7} 140 ${yBrume} T 260 ${yBrume} T 380 ${yBrume} T 500 ${yBrume} T 620 ${yBrume} T 740 ${yBrume} T 860 ${yBrume} T 978 ${yBrume}`" />
      <text x="84" :y="Math.min(HAUTEUR - 42, yBrume + 30)" class="legende-brume">Mer de brume</text>
      <text x="84" :y="Math.min(HAUTEUR - 26, yBrume + 46)" class="cote-brume">{{ formaterAltitude(brume) }}</text>
      <text
        v-for="(ile, i) in englouties"
        :key="ile.id"
        :x="LARGEUR - 48"
        :y="Math.min(HAUTEUR - 30, yBrume + 32 + i * 18)"
        text-anchor="end"
        class="engloutie"
      >✕ {{ ile.nom }}, engloutie</text>
    </g>
  </svg>
</template>

<style scoped>
.croquis { display: block; width: 100%; height: auto; }
.trait-fort { fill: none; stroke: var(--encre); stroke-width: 1.3; }
.trait-fin { fill: none; stroke: var(--encre); stroke-width: 0.7; }
.repere { stroke: var(--encre-2); stroke-width: 0.6; stroke-dasharray: 1 6; opacity: 0.7; }
.intitule { font-family: var(--f-titre); font-style: italic; font-size: 17px; fill: var(--encre-2); letter-spacing: 0.04em; }
.cote-regle, .cote-brume, .altitude { font-family: var(--f-cote); font-size: 11.5px; fill: var(--encre-2); }
.unite { font-family: var(--f-titre); font-style: italic; font-size: 13px; fill: var(--encre-2); }

.ile { cursor: pointer; outline: none; }
.lueur { fill: url(#lueur); opacity: 0.55; }
.roche-lavis { fill: url(#roche); filter: url(#aquarelle); opacity: 0.9; }
.roche-ombre { fill: url(#hachures-sepia); }
.roche-trait { fill: none; stroke: var(--encre); stroke-width: 1.2; filter: url(#plume); }
.cristal { fill: var(--cristal); stroke: #1f3f52; stroke-width: 0.6; }
.dome { fill: var(--lavis-vert); stroke: var(--encre); stroke-width: 1.1; filter: url(#plume); }
.tour rect { fill: var(--papier-2); stroke: var(--encre); stroke-width: 0.8; }
.toit { fill: #8a3b2c; stroke: var(--encre); stroke-width: 0.7; }
.arbre line { stroke: var(--encre); stroke-width: 0.8; }
.arbre circle { fill: var(--lavis-vert-sombre); stroke: var(--encre); stroke-width: 0.7; }
.entoure { fill: none; stroke: var(--rouge); stroke-width: 1.8; filter: url(#plume); }
.zone-clic { fill: transparent; }
.ile:hover .roche-trait, .ile:focus-visible .roche-trait { stroke-width: 2; }
.ile:focus-visible .entoure, .ile:focus-visible .dome { stroke: var(--rouge); }

.etiquettes, .brume { pointer-events: none; }
.nom { font-family: var(--f-titre); font-style: italic; font-size: 16px; fill: var(--encre); paint-order: stroke; stroke: var(--papier); stroke-width: 4px; stroke-linejoin: round; }
.altitude { paint-order: stroke; stroke: var(--papier); stroke-width: 4px; stroke-linejoin: round; }
.ecart { fill: var(--rouge); font-weight: 600; }
.renvoi { stroke: var(--encre-2); stroke-width: 0.7; stroke-dasharray: 2 2; }
.choisie .nom { fill: var(--rouge); }

.brume-fond { fill: var(--brume); opacity: 0.45; filter: url(#aquarelle); }
.nuage { filter: url(#flou-nuage); }
.nuage-0 { fill: #efe6f4; opacity: 0.75; }
.nuage-1 { fill: var(--brume); opacity: 0.7; }
.nuage-2 { fill: var(--brume-sombre); opacity: 0.75; }
.bord-brume { fill: none; stroke: var(--encre-2); stroke-width: 1; stroke-dasharray: 6 4; }
.legende-brume { font-family: var(--f-titre); font-style: italic; font-size: 18px; fill: var(--encre); paint-order: stroke; stroke: #e7dfe9; stroke-width: 3px; }
.cote-brume { fill: var(--encre); paint-order: stroke; stroke: #e7dfe9; stroke-width: 3px; }
.engloutie { font-family: var(--f-titre); font-style: italic; font-size: 15px; fill: var(--rouge); paint-order: stroke; stroke: #e7dfe9; stroke-width: 3px; }

@media (prefers-reduced-motion: no-preference) {
  .derive { animation: derive 26s ease-in-out infinite alternate; }
}
@keyframes derive { from { transform: translateX(-14px); } to { transform: translateX(14px); } }
</style>
