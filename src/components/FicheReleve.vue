<script setup>
import { computed } from 'vue'
import { formaterAltitude, NOMS_STATUT_ILE } from '../composables/format.js'
import MissionLigne from './MissionLigne.vue'

const props = defineProps({
  ile: { type: Object, default: null },
  missions: { type: Array, default: () => [] },
  nomsIles: { type: Object, required: true },
})

// Les relevés, du plus récent au plus ancien, avec l'écart par rapport au précédent.
const releves = computed(() => {
  const h = props.ile?.historique ?? []
  return h
    .map((r, i) => ({ ...r, ecart: i > 0 ? r.alt - h[i - 1].alt : null }))
    .reverse()
    .slice(0, 6)
})
</script>

<template>
  <section class="fiche" aria-labelledby="titre-fiche">
    <p class="petites-capitales">Fiche de relevé</p>
    <template v-if="ile">
      <div class="entete">
        <h2 id="titre-fiche">{{ ile.nom }}</h2>
        <span class="tampon" :class="`tampon--${ile.statut}`">{{ NOMS_STATUT_ILE[ile.statut] }}</span>
      </div>
      <p class="hauteur cote">{{ ile.statut === 'tombee' ? 'Sous la brume' : formaterAltitude(ile.alt) }}</p>
      <p v-if="ile.description" class="description">{{ ile.description }}</p>

      <table v-if="releves.length" class="releves">
        <caption class="petites-capitales">Relevés d'altitude</caption>
        <thead>
          <tr><th scope="col">Relevé</th><th scope="col">Altitude</th><th scope="col">Écart</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in releves" :key="r.s">
            <td>{{ r.s }}</td>
            <td class="cote">{{ formaterAltitude(r.alt) }}</td>
            <td class="cote" :class="{ baisse: r.ecart < 0 }">{{ r.ecart ? `${r.ecart > 0 ? '+' : '−'}${Math.abs(r.ecart)} m` : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="vide">Aucun relevé d'altitude pour cette île.</p>

      <div v-if="missions.length" class="missions">
        <p class="petites-capitales">Ordres pour cette île</p>
        <MissionLigne v-for="m in missions" :key="m.id" :mission="m" :nom-ile="nomsIles[m.ile]" />
      </div>
    </template>
    <template v-else>
      <h2 id="titre-fiche">Aucune île choisie</h2>
      <p class="vide">Touchez une île sur la planche pour ouvrir sa fiche : altitude, relevés successifs et ordres de mission.</p>
    </template>
  </section>
</template>

<style scoped>
.fiche { display: flex; flex-direction: column; gap: 0.6rem; }
.entete { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; }
h2 { font-size: var(--t-l); }
.hauteur { font-size: 2rem; line-height: 1; margin: 0; }
.description { margin: 0; font-style: italic; color: var(--encre-2); }
.vide { margin: 0; color: var(--encre-2); }
.releves { width: 100%; border-collapse: collapse; font-size: var(--t-s); }
.releves caption { text-align: left; padding-bottom: 0.3rem; }
.releves th { text-align: left; font-weight: 400; font-style: italic; color: var(--encre-2); border-bottom: 1px solid var(--encre); padding: 0.2rem 0; }
.releves td { border-bottom: 1px dotted var(--trait); padding: 0.25rem 0; }
.baisse { color: var(--ambre); }
.missions { display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.4rem; }
</style>
