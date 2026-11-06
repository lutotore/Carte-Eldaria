<script setup>
import { reactive, ref, watchEffect } from 'vue'
import { api } from '../../api/client.js'

/**
 * Les choix des niveaux d'avant le rattachement aux règles (manifestations occultes, faveur de pacte, style de combat…) :
 * le serveur dit ce qui manque et les options permises ; on coche, il vérifie.
 */
const props = defineProps({
  campagneId: { type: [String, Number], required: true },
  personnage: { type: Object, required: true },
})
const emit = defineEmits(['recharger'])

const coches = reactive({})
const enCours = ref(false)
const erreur = ref('')

// Une case à cocher par option : chaque liste en retard a son tableau (sinon v-model en ferait un booléen).
watchEffect(() => {
  for (const { cle } of props.personnage.choixEnRetard ?? []) coches[cle] ??= []
})

const pris = (cle) => coches[cle] ?? []
const bloque = (retard, id) => !pris(retard.cle).includes(id) && pris(retard.cle).length >= retard.manquants

async function valider(retard) {
  enCours.value = true
  erreur.value = ''
  try {
    await api.rattraperChoix(props.campagneId, props.personnage.id, retard.cle, pris(retard.cle))
    coches[retard.cle] = []
    emit('recharger')
  } catch (e) {
    erreur.value = e.message
  } finally {
    enCours.value = false
  }
}
</script>

<template>
  <section v-if="personnage.choixEnRetard?.length" class="retards papier" aria-labelledby="titre-retards">
    <h2 id="titre-retards">Choix à compléter</h2>
    <p class="chapeau">Ta fiche suit les règles depuis un niveau déjà avancé : il reste ces choix des niveaux passés.</p>
    <form v-for="retard in personnage.choixEnRetard" :key="retard.cle" class="retard" @submit.prevent="valider(retard)">
      <fieldset>
        <legend>{{ retard.libelle }} — encore {{ retard.manquants }} à choisir</legend>
        <div class="options">
          <label v-for="o in retard.options" :key="o.id" class="option">
            <input v-model="coches[retard.cle]" type="checkbox" :value="o.id" :disabled="bloque(retard, o.id)">
            {{ o.nom }}
          </label>
        </div>
      </fieldset>
      <button type="submit" class="bouton bouton--plein" :disabled="enCours || !pris(retard.cle).length">Enregistrer</button>
    </form>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
  </section>
</template>

<style scoped>
.retards { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; border-left: 4px solid var(--rouge); }
.retards h2 { margin: 0; font-size: 1.15rem; }
.chapeau { margin: 0; font-style: italic; }
.retard { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; }
.retard fieldset { margin: 0; width: 100%; border: 1.5px solid var(--encre-2); border-radius: 6px; padding: 0.4rem 0.7rem 0.6rem; }
.retard legend { font-weight: bold; padding: 0 0.3rem; }
.options { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.1rem 0.8rem; }
.option { display: flex; gap: 0.35rem; align-items: baseline; font-size: 0.95rem; }
</style>
