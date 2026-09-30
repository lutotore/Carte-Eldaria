<script setup>
import { computed, ref } from 'vue'
import { contenuIcs, decrireSeance, lienGoogleAgenda } from '../../domain/agenda.js'

const props = defineProps({
  seance: { type: Object, required: true },
  campagne: { type: String, required: true },
  estMj: { type: Boolean, default: false },
  enCours: { type: Boolean, default: false },
})
const emit = defineEmits(['annuler'])

const confirmer = ref(false)
const pourAgenda = computed(() => ({ ...props.seance, campagne: props.campagne }))

/** Le fichier .ics est fabriqué dans le navigateur : rien ne part vers un autre site. */
function telechargerIcs() {
  const texte = contenuIcs(pourAgenda.value, { origine: window.location.origin, maintenant: new Date() })
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(new Blob([texte], { type: 'text/calendar;charset=utf-8' }))
  lien.download = `seance-${props.seance.jour}.ics`
  lien.click()
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000)
}
</script>

<template>
  <section class="prochaine papier epingle" aria-labelledby="titre-prochaine">
    <p class="petites-capitales">Prochaine séance</p>
    <h2 id="titre-prochaine">{{ decrireSeance(seance) }}</h2>
    <p v-if="seance.lieu" class="lieu">{{ seance.lieu }}</p>
    <div class="actions">
      <a class="bouton bouton--plein" :href="lienGoogleAgenda(pourAgenda)" target="_blank" rel="noopener noreferrer">Ajouter à Google Agenda</a>
      <button type="button" class="bouton" @click="telechargerIcs">Autre agenda (.ics)</button>
      <template v-if="estMj">
        <button v-if="!confirmer" type="button" class="lien-bouton annuler" @click="confirmer = true">Annuler la séance…</button>
        <span v-else class="confirmer">
          <button type="button" class="bouton bouton--rouge" :disabled="enCours" @click="emit('annuler')">Oui, annuler et prévenir tout le monde</button>
          <button type="button" class="lien-bouton" @click="confirmer = false">Non</button>
        </span>
      </template>
    </div>
  </section>
</template>

<style scoped>
.prochaine { padding: 2rem 1.6rem 1.4rem; display: flex; flex-direction: column; gap: 0.5rem; }
.prochaine .petites-capitales { margin: 0; color: var(--encre-2); }
h2 { font-size: clamp(1.4rem, 3.5vw, 2rem); color: var(--encre); }
.lieu { margin: 0; font-style: italic; color: var(--encre-2); }
.actions { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; align-items: center; margin-top: 0.4rem; }
.annuler { color: var(--rouge); }
.confirmer { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
</style>
