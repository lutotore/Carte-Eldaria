<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/client.js'
import { utiliserEnvoi } from '../composables/envoi.js'
import { ouvrirSession } from '../session.js'

const route = useRoute()
const router = useRouter()
const identifiant = ref('')
const motDePasse = ref('')
const { enCours, erreur, envoyer } = utiliserEnvoi()

/** N'accepte qu'un retour vers une page du portail, jamais vers un autre site. */
const suite = () => (typeof route.query.suite === 'string' && route.query.suite.startsWith('/') && !route.query.suite.startsWith('//') ? route.query.suite : '/')

function connecter() {
  return envoyer(async () => {
    ouvrirSession(await api.connecter(identifiant.value.trim(), motDePasse.value))
    await router.replace(suite())
  })
}
</script>

<template>
  <main class="page-feuille">
    <section class="feuille papier epingle" aria-labelledby="titre">
      <p class="surtitre petites-capitales">Compagnie de l'Horizon</p>
      <h1 id="titre">Monter à bord</h1>
      <form @submit.prevent="connecter">
        <label class="champ">Identifiant
          <input v-model="identifiant" type="text" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
        </label>
        <label class="champ">Mot de passe
          <input v-model="motDePasse" type="password" name="password" autocomplete="current-password" required>
        </label>
        <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
        <div class="actions">
          <button type="submit" class="bouton bouton--plein bouton--grand" :disabled="enCours">Se connecter</button>
        </div>
      </form>
      <hr class="separateur">
      <p class="chapeau">Pas encore de compte ? Il te faut un lien d'invitation de ton MJ. Mot de passe oublié ? Ton MJ peut t'envoyer un lien pour en choisir un nouveau.</p>
    </section>
  </main>
</template>
