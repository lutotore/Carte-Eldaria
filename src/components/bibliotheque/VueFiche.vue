<script setup>
import { computed } from 'vue'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import { LIBELLES_FACETTES, SECTIONS_TITREES, TITREES_PAR_TYPE, valeurLisible } from '../../domain/fiches.js'
import Portrait from './Portrait.vue'

const props = defineProps({
  campagneId: { type: String, required: true },
  fiche: { type: Object, required: true },
  /** Pour une créature : chaque statistique, avec sa vraie valeur (si révélée) ou l'estimation du groupe. */
  grille: { type: Array, default: () => [] },
})
const emit = defineEmits(['recharger'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const creature = computed(() => props.fiche.type === 'creature')
const titrees = computed(() => TITREES_PAR_TYPE[props.fiche.type])
const cles = computed(() => new Set(props.grille.map((l) => l.cle)))
/** Facettes affichées en texte libre : tout sauf les statistiques (grille) et les éléments titrés (sections). */
const libres = computed(() => props.fiche.facettes.filter((f) => !titrees.value.includes(f.cle) && !cles.value.has(f.cle)))
const elementsDe = (cle) => props.fiche.facettes.filter((f) => f.cle === cle)

const estimer = (cle, texte) => envoyer(async () => {
  await api.estimer(props.campagneId, props.fiche.id, cle, texte)
  emit('recharger')
})
</script>

<template>
  <section class="vue papier epingle" aria-labelledby="titre-fiche">
    <Portrait v-if="fiche.portrait" :campagne-id="campagneId" :image-id="fiche.portrait" :nom="fiche.nom ?? ''" taille="grand" class="portrait" />
    <div class="corps">
      <h1 id="titre-fiche">{{ fiche.nom ?? (creature ? 'Créature inconnue' : 'Personnage inconnu') }}</h1>
      <dl>
        <template v-for="f in libres" :key="f.id">
          <dt>
            {{ LIBELLES_FACETTES[f.cle] }}
            <span v-if="f.pourMoiSeul" class="pour-moi" title="Les autres joueurs ne le savent pas">rien que pour toi</span>
          </dt>
          <dd>{{ valeurLisible(f.cle, f.valeur) }}</dd>
        </template>
      </dl>

      <div v-if="creature" class="bloc">
        <p class="aide">Ce que le groupe ne sait pas encore, notez-le : votre estimation sera corrigée dès que la vraie valeur sera connue.</p>
        <div v-for="ligne in grille" :key="ligne.cle" class="stat" :class="{ connue: ligne.valeur !== null }">
          <span class="nom-stat">{{ LIBELLES_FACETTES[ligne.cle] }}</span>
          <template v-if="ligne.valeur !== null">
            <span class="valeur">{{ ligne.valeur }}<span v-if="ligne.pourMoiSeul" class="pour-moi">rien que pour toi</span></span>
            <s v-if="ligne.estimation" class="ancienne" :title="`Estimé par ${ligne.estimation.auteur}`">{{ ligne.estimation.texte }}</s>
          </template>
          <label v-else class="estimation">
            <span class="visuellement-cache">Estimation du groupe pour {{ LIBELLES_FACETTES[ligne.cle] }}</span>
            <input
              type="text" maxlength="200" :value="ligne.estimation?.texte ?? ''" placeholder="? — votre estimation" :disabled="enCours"
              @change="estimer(ligne.cle, $event.target.value)"
            >
            <small v-if="ligne.estimation">par {{ ligne.estimation.auteur }}</small>
          </label>
        </div>
        <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
      </div>

      <template v-for="cle in titrees" :key="cle">
        <section v-if="elementsDe(cle).length" class="section">
          <h2>{{ SECTIONS_TITREES[cle] }}</h2>
          <div v-for="f in elementsDe(cle)" :key="f.id" class="element" :class="{ secret: cle === 'secret' }">
            <strong>{{ f.titre }}.</strong> {{ f.valeur }}
            <span v-if="f.pourMoiSeul" class="pour-moi">rien que pour toi</span>
          </div>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.vue { padding: 2rem 1.6rem 1.4rem; display: flex; flex-wrap: wrap; gap: 1.4rem; }
.portrait { flex: none; }
.corps { flex: 1 1 18rem; min-width: 0; display: flex; flex-direction: column; gap: 0.9rem; }
h1 { font-size: clamp(1.7rem, 4vw, 2.3rem); color: var(--encre); }
h2 { font-size: 1.2rem; color: var(--ruban); border-bottom: 1.5px solid var(--ruban); padding-bottom: 0.15rem; margin-bottom: 0.4rem; }
dl { margin: 0; display: flex; flex-direction: column; gap: 0.7rem; }
dt { font-size: var(--t-xs); letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; color: var(--encre-2); }
dd { margin: 0.1rem 0 0; white-space: pre-line; }
.pour-moi { margin-left: 0.4rem; text-transform: none; letter-spacing: 0; font-weight: 400; font-style: italic; color: var(--ruban); font-size: var(--t-s); }
.bloc { border-top: 2px solid var(--ruban); border-bottom: 2px solid var(--ruban); padding: 0.6rem 0; display: flex; flex-direction: column; gap: 0.35rem; }
.aide { margin: 0 0 0.3rem; font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
.stat { display: grid; grid-template-columns: 11rem minmax(0, 1fr); gap: 0.2rem 0.8rem; align-items: baseline; }
@media (max-width: 560px) { .stat { grid-template-columns: minmax(0, 1fr); } }
.nom-stat { font-weight: 700; color: var(--ruban); }
.connue .valeur { color: var(--encre); }
.ancienne { grid-column: 2; color: var(--encre-2); font-size: var(--t-s); }
@media (max-width: 560px) { .ancienne { grid-column: 1; } }
.estimation { display: flex; gap: 0.5rem; align-items: baseline; }
.estimation input { flex: 1; min-width: 0; border: 1px dashed var(--papier-ombre); border-radius: 3px; background: rgba(246, 236, 212, 0.6); padding: 0.2rem 0.45rem; color: var(--cristal); font-style: italic; }
.estimation small { color: var(--encre-2); white-space: nowrap; }
.element { margin-bottom: 0.45rem; line-height: 1.45; }
.element strong { font-style: italic; }
.element.secret { padding-left: 0.7rem; border-left: 3px solid var(--ruban); }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
