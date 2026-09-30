<script setup>
import { ref, watch } from 'vue'
import { jourLisible } from '../../domain/agenda.js'
import { enHeure } from '../../domain/planning.js'

const props = defineProps({
  sondage: { type: Object, required: true },
  moiId: { type: Number, required: true },
  enCours: { type: Boolean, default: false },
})
const emit = defineEmits(['enregistrer'])

/** Brouillon modifiable : une ligne par date, pré-remplie avec la réponse déjà donnée. */
const brouillon = ref([])
function initialiser() {
  brouillon.value = props.sondage.dates.map((date) => {
    const deja = date.reponses.find((r) => r.utilisateurId === props.moiId)
    return {
      dateId: date.id,
      jour: date.jour,
      choix: deja ? (deja.disponible ? 'oui' : 'non') : '',
      debut: deja?.disponible ? enHeure(deja.debut) : '',
      fin: deja?.disponible ? enHeure(deja.fin) : '',
    }
  })
}
watch(() => props.sondage, initialiser, { immediate: true })

function envoyer() {
  const reponses = brouillon.value.filter((l) => l.choix).map((l) => (l.choix === 'oui'
    ? { dateId: l.dateId, disponible: true, debut: l.debut, fin: l.fin }
    : { dateId: l.dateId, disponible: false }))
  emit('enregistrer', reponses)
}
</script>

<template>
  <form class="dispos papier epingle" @submit.prevent="envoyer">
    <h2>Mes disponibilités</h2>
    <p v-if="sondage.dateLimite" class="chapeau">À donner au plus tard le {{ jourLisible(sondage.dateLimite) }}.</p>
    <p v-if="!sondage.ouvertAuxReponses" class="message message--erreur">La date limite est passée : les réponses sont fermées.</p>

    <fieldset v-for="ligne in brouillon" :key="ligne.dateId" class="ligne" :disabled="!sondage.ouvertAuxReponses">
      <legend>{{ jourLisible(ligne.jour) }}</legend>
      <div class="choix">
        <label><input v-model="ligne.choix" type="radio" value="oui" :name="`choix-${ligne.dateId}`"> Disponible</label>
        <label><input v-model="ligne.choix" type="radio" value="non" :name="`choix-${ligne.dateId}`"> Pas disponible</label>
      </div>
      <div v-if="ligne.choix === 'oui'" class="plage">
        <label class="champ">De <input v-model="ligne.debut" type="time" step="900" required></label>
        <label class="champ">à <input v-model="ligne.fin" type="time" step="900" required></label>
        <span v-if="ligne.debut && ligne.fin && ligne.fin < ligne.debut" class="aide">jusqu'au lendemain</span>
      </div>
    </fieldset>

    <div v-if="sondage.ouvertAuxReponses" class="actions">
      <button type="submit" class="bouton bouton--plein" :disabled="enCours || !brouillon.some((l) => l.choix)">Enregistrer mes réponses</button>
    </div>
  </form>
</template>

<style scoped>
.dispos { padding: 2rem 1.6rem 1.4rem; display: flex; flex-direction: column; gap: 0.9rem; }
h2 { font-size: 1.6rem; color: var(--encre); }
.chapeau { margin: 0; }
.ligne { border: 0; border-bottom: 1px dashed var(--papier-ombre); margin: 0; padding: 0 0 0.8rem; display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: center; }
.ligne legend { float: left; width: 100%; font-family: var(--f-titre); font-size: 1.15rem; color: var(--encre); margin-bottom: 0.3rem; }
.choix { display: flex; flex-wrap: wrap; gap: 0.3rem 1.2rem; }
.choix label { display: inline-flex; gap: 0.35rem; align-items: center; }
.plage { display: flex; flex-wrap: wrap; gap: 0.5rem 0.8rem; align-items: flex-end; }
.plage .champ { flex-direction: row; align-items: center; gap: 0.4rem; }
.plage input { border: 1px solid var(--papier-ombre); border-radius: 3px; background: #f6ecd4; padding: 0.35rem 0.5rem; color: var(--encre); }
.aide { font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
</style>
