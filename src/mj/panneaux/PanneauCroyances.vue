<script setup>
import { computed, ref } from 'vue'
import { ajusterCroyance, lecturesEnTete, noterCroyance } from '../../domain/index.js'

const props = defineProps({ etat: { type: Object, required: true } })
const emit = defineEmits(['agir'])

const indice = ref('')
const note = ref('')

const total = computed(() => Math.max(1, ...Object.values(props.etat.croyances).map((v) => v)) )
const enTete = computed(() => {
  const cles = lecturesEnTete(props.etat.croyances)
  if (!cles.length) return 'Aucune tendance pour l’instant.'
  const noms = cles.map((c) => props.etat.regles.lectures.find((l) => l.cle === c)?.nom ?? c)
  return noms.length > 1 ? `${noms.join(' et ')} à égalité.` : `${noms[0]} en tête.`
})

function noter(lecture) {
  const texte = [indice.value, note.value.trim()].filter(Boolean).join(' — ')
  emit('agir', (e) => noterCroyance(e, lecture, texte))
  note.value = ''
}
</script>

<template>
  <div class="panneau">
    <p><strong>{{ enTete }}</strong> <span class="aide">Le registre décide de la forme finale de l'Abîme et des fins accessibles.</span></p>
    <div class="barres">
      <div v-for="l in etat.regles.lectures" :key="l.cle" class="barre">
        <span>{{ l.nom }}</span>
        <span class="jauge"><span class="rempli" :style="{ width: `${(etat.croyances[l.cle] / total) * 100}%` }" /></span>
        <span class="cote">{{ etat.croyances[l.cle] }}</span>
        <span class="pas">
          <button type="button" :aria-label="`Retirer un point à ${l.nom}`" @click="emit('agir', (e) => ajusterCroyance(e, l.cle, -1))">−</button>
          <button type="button" :aria-label="`Ajouter un point à ${l.nom}`" @click="emit('agir', (e) => ajusterCroyance(e, l.cle, 1))">+</button>
        </span>
      </div>
    </div>

    <fieldset class="formulaire">
      <legend>Noter un indice découvert</legend>
      <label class="champ">Indice
        <select v-model="indice">
          <option value="">Indice libre</option>
          <option v-for="i in etat.regles.indices" :key="i.texte" :value="i.texte">{{ i.texte }}</option>
        </select>
      </label>
      <label class="champ">Ce que le groupe en a conclu
        <input v-model="note" type="text">
      </label>
      <div class="choix">
        <span class="aide">Le groupe penche vers :</span>
        <button v-for="l in etat.regles.lectures" :key="l.cle" type="button" class="bouton" :disabled="!indice && !note.trim()" @click="noter(l.cle)">{{ l.nom }}</button>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.barres { display: flex; flex-direction: column; gap: 0.6rem; max-width: 44rem; }
.barre { display: grid; grid-template-columns: 9rem minmax(0, 1fr) 2rem auto; gap: 0.75rem; align-items: center; }
.jauge { height: 0.6rem; border: 1px solid var(--encre); }
.rempli { display: block; height: 100%; background: var(--encre); }
.formulaire { border: 1px solid var(--trait); padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; max-width: 44rem; }
legend { font-family: var(--f-titre); font-size: 1.1rem; padding: 0 0.3rem; }
.choix { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
</style>
