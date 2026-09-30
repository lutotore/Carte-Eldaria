<script setup>
import { LIBELLES_FACETTES, valeurLisible } from '../../domain/fiches.js'
import Portrait from './Portrait.vue'

defineProps({
  campagneId: { type: String, required: true },
  fiche: { type: Object, required: true },
})
</script>

<template>
  <section class="vue papier epingle" aria-labelledby="titre-fiche">
    <Portrait v-if="fiche.portrait" :campagne-id="campagneId" :image-id="fiche.portrait" :nom="fiche.nom ?? ''" taille="grand" class="portrait" />
    <div class="corps">
      <h1 id="titre-fiche">{{ fiche.nom ?? 'Personnage inconnu' }}</h1>
      <dl>
        <template v-for="f in fiche.facettes" :key="f.id">
          <dt>
            {{ f.cle === 'secret' ? f.titre : LIBELLES_FACETTES[f.cle] }}
            <span v-if="f.pourMoiSeul" class="pour-moi" title="Les autres joueurs ne le savent pas">rien que pour toi</span>
          </dt>
          <dd :class="{ secret: f.cle === 'secret' }">{{ valeurLisible(f.cle, f.valeur) }}</dd>
        </template>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.vue { padding: 2rem 1.6rem 1.4rem; display: flex; flex-wrap: wrap; gap: 1.4rem; }
.portrait { flex: none; }
.corps { flex: 1 1 18rem; min-width: 0; }
h1 { font-size: clamp(1.7rem, 4vw, 2.3rem); color: var(--encre); margin-bottom: 0.8rem; }
dl { margin: 0; display: flex; flex-direction: column; gap: 0.7rem; }
dt { font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; color: var(--encre-2); }
dd { margin: 0.1rem 0 0; white-space: pre-line; }
dd.secret { padding-left: 0.7rem; border-left: 3px solid var(--ruban); font-style: italic; }
.pour-moi { margin-left: 0.4rem; text-transform: none; letter-spacing: 0; font-weight: 400; font-style: italic; color: var(--ruban); }
</style>
