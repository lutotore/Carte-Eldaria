<script setup>
import { ref } from 'vue'
import { publierNouvelle, retirerNouvelle } from '../../domain/index.js'

defineProps({ etat: { type: Object, required: true } })
const emit = defineEmits(['agir'])
const titre = ref('')
const texte = ref('')

function publier() {
  emit('agir', (e) => publierNouvelle(e, { titre: titre.value, texte: texte.value }))
  titre.value = ''
  texte.value = ''
}
</script>

<template>
  <div class="panneau deux-colonnes">
    <form class="formulaire" @submit.prevent="publier">
      <h3>Publier une nouvelle</h3>
      <label class="champ">Titre<input v-model="titre" type="text" required></label>
      <label class="champ">Texte<textarea v-model="texte" /></label>
      <p><button type="submit" class="bouton bouton--plein" :disabled="!titre.trim()">Publier dans la Gazette</button></p>
    </form>
    <div>
      <h3>Déjà publiées</h3>
      <article v-for="(n, i) in etat.nouvelles" :key="`${n.t}-${i}`" class="publiee">
        <p class="petites-capitales">{{ n.t }}</p>
        <strong>{{ n.titre }}</strong>
        <p v-if="n.texte" class="texte">{{ n.texte }}</p>
        <button type="button" class="bouton bouton--rouge" @click="emit('agir', (e) => retirerNouvelle(e, i))">Retirer</button>
      </article>
      <p v-if="!etat.nouvelles.length" class="aide">Aucune nouvelle publiée.</p>
    </div>
  </div>
</template>

<style scoped>
h3 { font-size: 1.2rem; margin-bottom: 0.5rem; }
.formulaire { display: flex; flex-direction: column; gap: 0.6rem; }
.publiee { border-top: 1px solid var(--trait); padding: 0.5rem 0; display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start; }
.texte { margin: 0; }
</style>
