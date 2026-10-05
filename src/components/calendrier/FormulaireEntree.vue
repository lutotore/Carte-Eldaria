<script setup>
import { computed, ref } from 'vue'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import SelecteurDate from './SelecteurDate.vue'
import { TYPES_ENTREE, VISIBILITES } from './types.js'

/** Crée ou modifie une entrée du calendrier. Un MJ écrit des événements, fêtes et chroniques ; un joueur, des notes. */
const props = defineProps({
  campagneId: { type: String, required: true },
  estMj: { type: Boolean, default: false },
  /** L'entrée à modifier, ou null pour en créer une. */
  entree: { type: Object, default: null },
  jourInitial: { type: Number, required: true },
})
const emit = defineEmits(['enregistre', 'annuler'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const typeParDefaut = props.estMj ? 'evenement' : 'note'
const saisie = ref(props.entree
  ? { type: props.entree.type, titre: props.entree.titre, description: props.entree.description, jour: props.entree.jour, duree: props.entree.duree, annuel: props.entree.annuel, visibilite: props.entree.visibilite }
  : { type: typeParDefaut, titre: '', description: '', jour: props.jourInitial, duree: 1, annuel: false, visibilite: props.estMj ? 'cache' : 'privee' })

/** Une note reste une note ; un MJ choisit parmi ses propres sortes d'entrées. */
const typesPossibles = computed(() => (saisie.value.type === 'note' ? ['note'] : ['evenement', 'fete', 'chronique']))
const visibilites = computed(() => TYPES_ENTREE[saisie.value.type].visibilites)

const enregistrer = () => envoyer(async () => {
  if (props.entree) await api.modifierEvenement(props.campagneId, props.entree.id, saisie.value)
  else await api.creerEvenement(props.campagneId, saisie.value)
  emit('enregistre', props.entree ? 'Entrée enregistrée.' : 'Entrée ajoutée au calendrier.')
})
</script>

<template>
  <form class="formulaire" @submit.prevent="enregistrer">
    <div class="ligne">
      <label v-if="typesPossibles.length > 1" class="champ">Sorte
        <select v-model="saisie.type">
          <option v-for="t in typesPossibles" :key="t" :value="t">{{ TYPES_ENTREE[t].nom }}</option>
        </select>
      </label>
      <label class="champ titre">Titre <input v-model="saisie.titre" maxlength="120" required></label>
    </div>
    <div class="ligne">
      <SelecteurDate v-model="saisie.jour" legende="Commence le" />
      <label class="champ duree">Durée (jours) <input v-model.number="saisie.duree" type="number" min="1" max="365" required></label>
      <label class="coche"><input v-model="saisie.annuel" type="checkbox"> Chaque année</label>
    </div>
    <label class="champ">Description <textarea v-model="saisie.description" rows="3" maxlength="4000" /></label>
    <div class="ligne">
      <label class="champ">Qui la voit
        <select v-model="saisie.visibilite">
          <option v-for="v in visibilites" :key="v" :value="v">{{ VISIBILITES[v] }}</option>
        </select>
      </label>
      <div class="actions">
        <button type="submit" class="bouton bouton--plein" :disabled="enCours">{{ entree ? 'Enregistrer' : 'Ajouter' }}</button>
        <button type="button" class="lien-bouton" @click="emit('annuler')">Annuler</button>
      </div>
    </div>
    <p v-if="saisie.visibilite === 'groupe' && saisie.type !== 'note' && entree?.visibilite !== 'groupe'" class="aide">Les joueurs seront prévenus.</p>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
  </form>
</template>

<style scoped>
.formulaire { display: flex; flex-direction: column; gap: 0.6rem; }
.ligne { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; align-items: flex-end; }
.titre { flex: 1 1 14rem; }
.duree input { width: 5rem; }
.coche { display: flex; gap: 0.35rem; align-items: center; font-size: var(--t-s); padding-bottom: 0.4rem; }
.actions { display: flex; gap: 0.6rem; align-items: center; margin-left: auto; }
.aide { margin: 0; font-size: var(--t-s); font-style: italic; color: var(--encre-2); }
</style>
