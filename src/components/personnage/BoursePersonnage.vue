<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import { PIECES, valeurEnPo } from '../../domain/personnage.js'

/** La bourse : le joueur (ou un MJ) la tient à jour ; les pièces prises dans un butin y arrivent seules. */
const props = defineProps({
  campagneId: { type: String, required: true },
  personnageId: { type: Number, required: true },
  bourse: { type: Object, required: true },
})
const emit = defineEmits(['recharger'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const saisie = ref({ ...props.bourse })
/** Une saisie en cours n'est pas effacée par le rechargement de la fiche (inventaire, Marque…). */
watch(() => props.bourse, (nouvelle, ancienne) => {
  if (PIECES.every((p) => saisie.value[p.cle] === ancienne[p.cle])) saisie.value = { ...nouvelle }
})
const modifiee = computed(() => PIECES.some((p) => saisie.value[p.cle] !== props.bourse[p.cle]))
const valide = computed(() => PIECES.every((p) => Number.isInteger(saisie.value[p.cle]) && saisie.value[p.cle] >= 0))
const total = computed(() => valeurEnPo(props.bourse).toLocaleString('fr-FR', { maximumFractionDigits: 2 }))

const enregistrer = () => envoyer(async () => {
  try {
    await api.changerBourse(props.campagneId, props.personnageId, props.bourse, saisie.value)
  } catch (e) {
    // La bourse a changé entre-temps : on repart de la vraie valeur.
    saisie.value = { ...props.bourse }
    throw e
  } finally {
    emit('recharger')
  }
})
</script>

<template>
  <section class="bourse papier" aria-labelledby="titre-bourse">
    <h2 id="titre-bourse">Bourse</h2>
    <form @submit.prevent="enregistrer">
      <div class="pieces">
        <label v-for="p in PIECES" :key="p.cle" class="piece" :class="`piece--${p.cle}`">
          <input v-model.number="saisie[p.cle]" type="number" min="0" step="1" :aria-label="`Pièces de ${p.nom.toLowerCase()}`">
          <span>{{ p.cle }}</span>
        </label>
      </div>
      <p class="total">Soit {{ total }} po en tout.</p>
      <div v-if="modifiee" class="actions">
        <button type="submit" class="bouton bouton--plein" :disabled="enCours || !valide">Enregistrer la bourse</button>
        <button type="button" class="lien-bouton" @click="saisie = { ...bourse }">Annuler</button>
      </div>
      <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
    </form>
  </section>
</template>

<style scoped>
.bourse { padding: 1.2rem 1.2rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
h2 { font-size: 1.35rem; }
form { display: flex; flex-direction: column; gap: 0.5rem; }
.pieces { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.piece { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; width: 4.6rem; padding: 0.35rem 0.3rem; border-radius: 50% / 40%; border: 2px solid; font-family: var(--f-cote); font-size: var(--t-xs); text-transform: uppercase; }
.piece input { width: 100%; text-align: center; border: 0; border-bottom: 1px solid currentColor; background: transparent; color: var(--encre); font-family: var(--f-cote); font-size: 1rem; }
.piece--pp { color: #6f7680; }
.piece--po { color: #9c7130; }
.piece--pe { color: #8a7a45; }
.piece--pa { color: #7d8288; }
.piece--pc { color: #8e5233; }
.total { margin: 0; font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
.actions { display: flex; gap: 0.6rem; align-items: center; }
</style>
