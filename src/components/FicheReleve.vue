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
  <section class="page papier" aria-labelledby="titre-fiche">
    <p class="petites-capitales titre-page">Fiche de relevé</p>
    <template v-if="ile">
      <div class="entete">
        <h2 id="titre-fiche">{{ ile.nom }}</h2>
        <span class="tampon" :class="`tampon--${ile.statut}`">{{ NOMS_STATUT_ILE[ile.statut] }}</span>
      </div>
      <p class="hauteur cote">{{ ile.statut === 'tombee' ? 'sous la brume' : formaterAltitude(ile.alt) }}</p>
      <p v-if="ile.description" class="description">{{ ile.description }}</p>

      <table v-if="releves.length" class="releves">
        <caption>Relevés d'altitude</caption>
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
/* Une page de carnet : lignes bleues, marge rouge. */
.page {
  --interligne: 1.75rem;
  padding: 1.1rem 1.2rem 1.4rem 3.2rem;
  line-height: var(--interligne);
  background-image:
    linear-gradient(90deg, transparent 2.3rem, rgba(150, 44, 34, 0.45) 2.3rem, rgba(150, 44, 34, 0.45) calc(2.3rem + 1px), transparent calc(2.3rem + 1px)),
    repeating-linear-gradient(transparent 0, transparent calc(var(--interligne) - 1px), var(--ligne-cahier) calc(var(--interligne) - 1px), var(--ligne-cahier) var(--interligne)),
    var(--grain-papier);
  background-position: 0 0, 0 0.9rem, 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.titre-page { margin: 0; color: var(--encre-2); }
.entete { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
h2 { font-size: 1.7rem; line-height: 1.2; }
.hauteur { font-size: 2rem; margin: 0; color: var(--encre); }
.description { margin: 0; font-style: italic; color: var(--encre-2); }
.vide { margin: 0; color: var(--encre-2); font-style: italic; }
.releves { width: 100%; border-collapse: collapse; font-size: var(--t-s); margin-top: 0.4rem; }
.releves caption { text-align: left; font-family: var(--f-titre); font-style: italic; font-size: 1.05rem; }
.releves th { text-align: left; font-weight: 400; font-style: italic; color: var(--encre-2); }
.baisse { color: var(--rouge); }
.missions { display: flex; flex-direction: column; margin-top: 0.6rem; }
.missions .petites-capitales { margin: 0; color: var(--encre-2); }
</style>
