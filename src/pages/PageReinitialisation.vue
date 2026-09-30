<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '../api/client.js'
import { utiliserEnvoi } from '../composables/envoi.js'

const props = defineProps({ jeton: { type: String, required: true } })

const lien = ref(null)
const erreurLien = ref('')
const motDePasse = ref('')
const confirmation = ref('')
const termine = ref(false)
const { enCours, erreur, envoyer } = utiliserEnvoi()

const differents = computed(() => confirmation.value.length > 0 && confirmation.value !== motDePasse.value)

onMounted(async () => {
  try {
    lien.value = await api.lireReinitialisation(props.jeton)
  } catch (e) {
    erreurLien.value = e.message
  }
})

function valider() {
  if (differents.value) return undefined
  return envoyer(async () => {
    await api.reinitialiser(props.jeton, motDePasse.value)
    termine.value = true
  })
}
</script>

<template>
  <main class="page-feuille">
    <section class="feuille papier epingle" aria-labelledby="titre">
      <h1 id="titre">Nouveau mot de passe</h1>

      <template v-if="erreurLien">
        <p class="message message--erreur" role="alert">{{ erreurLien }}</p>
      </template>

      <template v-else-if="termine">
        <p class="message message--ok" role="status">C'est fait. Toutes tes anciennes sessions ont été fermées.</p>
        <div class="actions"><RouterLink to="/connexion" class="bouton bouton--plein bouton--grand">Se connecter</RouterLink></div>
      </template>

      <form v-else-if="lien" @submit.prevent="valider">
        <p>Choisis un nouveau mot de passe pour <strong>{{ lien.identifiant }}</strong>.</p>
        <input type="text" name="username" autocomplete="username" :value="lien.identifiant" hidden readonly>
        <label class="champ">Nouveau mot de passe (12 caractères minimum)
          <input v-model="motDePasse" type="password" autocomplete="new-password" minlength="12" required>
        </label>
        <label class="champ">Confirme le mot de passe
          <input v-model="confirmation" type="password" autocomplete="new-password" minlength="12" required :aria-invalid="differents">
        </label>
        <p v-if="differents" class="message message--erreur">Les deux mots de passe ne correspondent pas.</p>
        <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
        <div class="actions">
          <button type="submit" class="bouton bouton--plein bouton--grand" :disabled="enCours || differents">Enregistrer</button>
        </div>
      </form>

      <p v-else class="chapeau">Lecture du lien…</p>
    </section>
  </main>
</template>
