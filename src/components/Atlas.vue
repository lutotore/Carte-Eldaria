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
})

const CLE_VUE = 'eldaria-vue'
const lireVue = () => {
  try { return localStorage.getItem(CLE_VUE) === 'plan' ? 'plan' : 'elevation' } catch { return 'elevation' }
}
const vue = ref(lireVue())
watch(vue, (v) => { try { localStorage.setItem(CLE_VUE, v) } catch { /* stockage indisponible : sans conséquence */ } })

const selection = ref(null)
const choisir = (id) => { selection.value = selection.value === id ? null : id }

const nomsIles = computed(() => ({
  infronde: "L'Infronde",
  ...Object.fromEntries(props.monde.iles.map((i) => [i.id, i.nom])),
}))
const ileChoisie = computed(() => props.monde.iles.find((i) => i.id === selection.value) ?? null)
const missionsIle = computed(() => props.monde.missions.filter((m) => m.ile === selection.value))
</script>

<template>
  <div class="atlas">
    <header class="cartouche">
      <div class="titre">
        <p class="petites-capitales">Compagnie de l'Horizon · Service des relevés</p>
        <h1>Carte des Cieux d'Eldaria</h1>
        <p class="sous-titre">Dressée d'après les relevés d'A. Brisemont<span v-if="mentionMj"> · ce que voient les joueurs</span></p>
      </div>
      <dl class="releve">
        <div><dt>Acte</dt><dd>{{ NOMS_ACTE[monde.acte - 1] }}</dd></div>
        <div><dt>Relevé</dt><dd>{{ monde.session }}</dd></div>
        <div><dt>Mer de brume</dt><dd class="cote">{{ formaterAltitude(monde.brume) }}</dd></div>
      </dl>
    </header>

    <div class="corps">
      <section class="planche-cadre" aria-label="Planche">
        <div class="onglets" role="tablist" aria-label="Type de planche">
          <button type="button" role="tab" :aria-selected="vue === 'elevation'" @click="vue = 'elevation'">Élévation</button>
          <button type="button" role="tab" :aria-selected="vue === 'plan'" @click="vue = 'plan'">Plan</button>
        </div>
        <div class="defilement">
          <VueElevation v-if="vue === 'elevation'" :iles="monde.iles" :brume="monde.brume" :selection="selection" @choisir="choisir" />
          <VuePlan v-else :iles="monde.iles" :selection="selection" @choisir="choisir" />
        </div>
        <p class="legende">
          <span><i class="marque marque--descend" />Descend</span>
          <span><i class="marque marque--instable" />Instable</span>
          <span><i class="marque marque--tombee" />Engloutie</span>
          <span class="note">{{ vue === 'elevation' ? 'Hauteurs à l’échelle ; espacement des îles libre.' : 'Positions approximatives.' }}</span>
        </p>
      </section>

      <aside class="colonne">
        <FicheReleve :ile="ileChoisie" :missions="missionsIle" :noms-iles="nomsIles" />
        <OrdresDeMission :missions="monde.missions" :noms-iles="nomsIles" />
        <Gazette :nouvelles="monde.nouvelles" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.atlas {
  max-width: 1280px;
  margin: 0 auto;
  padding-inline: max(16px, env(safe-area-inset-left));
  padding-block: 1.25rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.cartouche {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem 2rem;
  border: 1px solid var(--encre);
  outline: 1px solid var(--encre);
  outline-offset: 3px;
  padding: 1rem 1.25rem;
  margin: 4px;
}
h1 { font-size: clamp(1.9rem, 4.2vw, 3rem); line-height: 1.05; }
.sous-titre { margin: 0.2rem 0 0; font-style: italic; color: var(--encre-2); }
.releve { display: flex; flex-wrap: wrap; gap: 0 1.75rem; margin: 0; }
.releve dt { font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; color: var(--encre-2); }
.releve dd { margin: 0; font-size: 1.15rem; }

.corps { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 1.5rem; align-items: start; }
@media (max-width: 960px) { .corps { grid-template-columns: minmax(0, 1fr); } }

.planche-cadre {
  min-width: 0;
  border: 1px solid var(--encre);
  background-color: var(--papier);
  background-image:
    linear-gradient(var(--papier-2) 1px, transparent 1px),
    linear-gradient(90deg, var(--papier-2) 1px, transparent 1px);
  background-size: 24px 24px;
}
/* Sur téléphone, la planche garde une taille lisible et défile horizontalement. */
.defilement { overflow-x: auto; }
.defilement > :deep(svg) { min-width: 720px; }
.onglets { display: flex; border-bottom: 1px solid var(--encre); background: var(--papier); }
.onglets button {
  background: none;
  border: 0;
  border-right: 1px solid var(--trait);
  padding: 0.5rem 1.1rem;
  font-family: var(--f-titre);
  font-size: 1.05rem;
  color: var(--encre-2);
}
.onglets button[aria-selected='true'] { color: var(--encre); background: var(--papier-2); box-shadow: inset 0 -2px 0 var(--encre); }
.legende {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.2rem;
  margin: 0;
  padding: 0.55rem 0.9rem;
  border-top: 1px solid var(--encre);
  background: var(--papier);
  font-size: var(--t-s);
}
.note { font-style: italic; color: var(--encre-2); margin-left: auto; }
.marque { display: inline-block; width: 1.1rem; height: 0; margin-right: 0.4rem; vertical-align: middle; border-top: 2px solid; }
.marque--descend { border-color: var(--ambre); border-top-style: dashed; }
.marque--instable { border-color: var(--encre); border-top-style: dotted; }
.marque--tombee { border-color: var(--rouge); border-top-style: dashed; }

.colonne { display: flex; flex-direction: column; gap: 1.75rem; min-width: 0; }
.colonne > :deep(section) { padding-top: 0.25rem; }
</style>
