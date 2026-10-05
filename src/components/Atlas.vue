<script setup>
import { computed, ref, watch } from 'vue'
import VueElevation from './VueElevation.vue'
import VuePlan from './VuePlan.vue'
import FicheReleve from './FicheReleve.vue'
import OrdresDeMission from './OrdresDeMission.vue'
import Gazette from './Gazette.vue'
import { formaterAltitude, NOMS_ACTE } from '../composables/format.js'

const props = defineProps({
  monde: { type: Object, required: true },
  mentionMj: { type: Boolean, default: false },
  /** Lieux connus, rangés par île (voir lieuxParIle). */
  lieux: { type: Map, default: () => new Map() },
  campagneId: { type: String, default: null },
  ileInitiale: { type: String, default: null },
})

const CLE_VUE = 'eldaria-vue'
const lireVue = () => {
  try { return localStorage.getItem(CLE_VUE) === 'plan' ? 'plan' : 'elevation' } catch { return 'elevation' }
}
const vue = ref(lireVue())
watch(vue, (v) => { try { localStorage.setItem(CLE_VUE, v) } catch { /* stockage indisponible : sans conséquence */ } })

const selection = ref(props.monde.iles.some((i) => i.id === props.ileInitiale) ? props.ileInitiale : null)
const choisir = (id) => { selection.value = selection.value === id ? null : id }

const nomsIles = computed(() => ({
  infronde: "L'Infronde",
  ...Object.fromEntries(props.monde.iles.map((i) => [i.id, i.nom])),
}))
const ileChoisie = computed(() => props.monde.iles.find((i) => i.id === selection.value) ?? null)
const lieuxIle = computed(() => props.lieux.get(selection.value) ?? [])
const missionsIle = computed(() => props.monde.missions.filter((m) => m.ile === selection.value))

const etiquettes = computed(() => [
  { nom: 'Acte', valeur: NOMS_ACTE[props.monde.acte - 1] },
  { nom: 'Relevé', valeur: props.monde.session },
  { nom: 'Mer de brume', valeur: formaterAltitude(props.monde.brume), cote: true },
])
</script>

<template>
  <div class="bureau">
    <header class="entete">
      <div class="plaque laiton">
        <p class="petites-capitales">Journal de bord du Sillage</p>
        <h1>Carte des Cieux d'Eldaria</h1>
        <p class="sous-titre">
          Relevés de la Compagnie de l'Horizon, d'après A. Brisemont<span v-if="mentionMj"> — tel que le voient les joueurs</span>
        </p>
      </div>
      <ul class="etiquettes" aria-label="Relevé en cours">
        <li v-for="e in etiquettes" :key="e.nom" class="etiquette papier">
          <span class="petites-capitales">{{ e.nom }}</span>
          <span class="valeur" :class="{ cote: e.cote }">{{ e.valeur }}</span>
        </li>
      </ul>
    </header>

    <div class="table-de-travail">
      <section class="planche papier epingle" aria-label="Planche des îles">
        <div class="rubans" role="tablist" aria-label="Type de planche">
          <button type="button" role="tab" class="ruban" :aria-selected="vue === 'elevation'" @click="vue = 'elevation'">Élévation</button>
          <button type="button" role="tab" class="ruban ruban--vert" :aria-selected="vue === 'plan'" @click="vue = 'plan'">Plan</button>
        </div>
        <div class="defilement">
          <VueElevation v-if="vue === 'elevation'" :iles="monde.iles" :brume="monde.brume" :selection="selection" @choisir="choisir" />
          <VuePlan v-else :iles="monde.iles" :selection="selection" @choisir="choisir" />
        </div>
        <p class="legende">
          <span><i class="signe signe--descend" />descend</span>
          <span><i class="signe signe--instable" />instable</span>
          <span><i class="signe signe--tombee" />engloutie</span>
          <span class="note">{{ vue === 'elevation' ? 'Hauteurs à l’échelle, espacement libre.' : 'Positions relevées à l’estime.' }}</span>
        </p>
      </section>

      <FicheReleve class="carnet" :ile="ileChoisie" :missions="missionsIle" :noms-iles="nomsIles" :lieux="lieuxIle" :campagne-id="campagneId" />
    </div>

    <div class="bas">
      <OrdresDeMission :missions="monde.missions" :noms-iles="nomsIles" />
      <Gazette :nouvelles="monde.nouvelles" />
    </div>
  </div>
</template>

<style scoped>
.bureau {
  max-width: 1320px;
  margin: 0 auto;
  padding-inline: max(16px, env(safe-area-inset-left));
  padding-block: 1.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* En-tête : plaque de laiton et étiquettes de relevé. */
.entete { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.25rem 2rem; }
.plaque { padding: 0.9rem 1.6rem 1rem; border-radius: 6px; position: relative; max-width: 100%; }
.plaque::before, .plaque::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 9px;
  height: 9px;
  margin-top: -4px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #f5dfa6, #7a5522);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
}
.plaque::before { left: 0.6rem; }
.plaque::after { right: 0.6rem; }
.plaque .petites-capitales { margin: 0; color: #5a3d16; }
h1 { font-size: clamp(1.9rem, 4.4vw, 3.1rem); line-height: 1.05; color: #2a1a0c; text-shadow: 0 1px 0 rgba(255, 240, 200, 0.6); }
.sous-titre { margin: 0.15rem 0 0; font-style: italic; color: #4a3317; }

.etiquettes { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.9rem; }
.etiquette {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.9rem 0.55rem 1.6rem;
  border-radius: 2px 10px 10px 2px;
  clip-path: polygon(14px 0, 100% 0, 100% 100%, 14px 100%, 0 50%);
  min-width: 7.5rem;
}
.etiquette:nth-child(2) { transform: rotate(1.5deg); }
.etiquette:nth-child(3) { transform: rotate(-1deg); }
.etiquette::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 50%;
  width: 7px;
  height: 7px;
  margin-top: -3.5px;
  border-radius: 50%;
  background: var(--cuir);
}
.etiquette .petites-capitales { color: var(--encre-2); }
.etiquette .valeur { font-size: 1.2rem; color: var(--encre); }

/* Table de travail : la planche épinglée et le carnet. */
.table-de-travail { display: grid; grid-template-columns: minmax(0, 1fr) 23rem; gap: 2rem; align-items: start; }
@media (max-width: 1000px) { .table-de-travail { grid-template-columns: minmax(0, 1fr); } }

.planche { padding: 2rem 1.1rem 0.4rem; transform: rotate(-0.25deg); min-width: 0; }
.defilement { overflow-x: auto; }
.defilement > :deep(svg) { min-width: 720px; }

.rubans { position: absolute; top: -6px; right: 3.2rem; display: flex; gap: 0.5rem; z-index: 3; }
.ruban {
  border: 0;
  padding: 0.6rem 0.8rem 1.1rem;
  font-family: var(--f-titre);
  font-size: 1rem;
  color: #f4e6c8;
  background: linear-gradient(90deg, #5e1822, var(--ruban) 30%, #8e3040 60%, var(--ruban));
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
  opacity: 0.75;
  transition: padding 0.2s ease, opacity 0.2s ease;
}
.ruban--vert { background: linear-gradient(90deg, #1e3a2d, var(--ruban-2) 30%, #3c6b55 60%, var(--ruban-2)); }
.ruban[aria-selected='true'] { padding-bottom: 1.8rem; opacity: 1; }
.ruban:focus-visible { outline-color: var(--laiton-clair); }

.legende {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1.2rem;
  margin: 0;
  padding: 0.4rem 0.6rem 0.8rem;
  font-family: var(--f-titre);
  font-style: italic;
  color: var(--encre-2);
}
.note { margin-left: auto; }
.signe { display: inline-block; width: 1.3rem; height: 0; margin-right: 0.4rem; vertical-align: middle; border-top: 2px dashed; }
.signe--descend { border-color: var(--ocre-alerte); }
.signe--instable { border-color: var(--cristal); border-top-style: dotted; }
.signe--tombee { border-color: var(--rouge); }

.carnet { transform: rotate(0.6deg); }

.bas { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 2rem; align-items: start; }
@media (max-width: 1000px) { .bas { grid-template-columns: minmax(0, 1fr); } }
</style>
