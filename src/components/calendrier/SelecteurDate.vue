<script setup>
import { computed } from 'vue'
import { ANNEE_MAX, CALENDRIER, depuisDate, versDate } from '../../domain/calendrier.js'

/** Choix d'une date d'Eldaria : jour, mois (ou Jours Blancs), année. Le modèle est un jour absolu. */
const jour = defineModel({ type: Number, required: true })
defineProps({ legende: { type: String, default: 'Date' } })

const date = computed(() => versDate(jour.value))
const nombreDeJours = computed(() => (date.value.mois === null ? CALENDRIER.intercalaires.jours : CALENDRIER.joursParMois))

/** Changer de mois garde le numéro du jour, ramené dans les limites du nouveau mois. */
function changer(partie, valeur) {
  const nouvelle = { ...date.value, [partie]: valeur }
  const max = nouvelle.mois === null ? CALENDRIER.intercalaires.jours : CALENDRIER.joursParMois
  const resultat = depuisDate({ ...nouvelle, jour: Math.min(nouvelle.jour, max) })
  if (resultat !== null) jour.value = resultat
}
</script>

<template>
  <fieldset class="selecteur">
    <legend>{{ legende }}</legend>
    <select :value="date.jour" aria-label="Jour" @change="changer('jour', Number($event.target.value))">
      <option v-for="n in nombreDeJours" :key="n" :value="n">{{ n }}</option>
    </select>
    <select :value="date.mois ?? 'blanc'" aria-label="Mois" @change="changer('mois', $event.target.value === 'blanc' ? null : Number($event.target.value))">
      <option v-for="(m, i) in CALENDRIER.mois" :key="m.nom" :value="i">{{ m.nom }}</option>
      <option value="blanc">{{ CALENDRIER.intercalaires.pluriel }}</option>
    </select>
    <input type="number" min="0" :max="ANNEE_MAX" :value="date.annee" aria-label="Année" class="annee" @change="Number.isInteger(Number($event.target.value)) && changer('annee', Number($event.target.value))">
    <span class="ere">{{ CALENDRIER.ere }}</span>
  </fieldset>
</template>

<style scoped>
.selecteur { margin: 0; padding: 0; border: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.selecteur legend { font-size: var(--t-s); color: var(--encre-2); padding: 0; margin-bottom: 0.2rem; }
select, input { border: 1px solid var(--papier-ombre); border-radius: 3px; background: #f6ecd4; color: var(--encre); padding: 0.3rem 0.4rem; }
.annee { width: 5.5rem; }
.ere { font-size: var(--t-s); color: var(--encre-2); }
</style>
