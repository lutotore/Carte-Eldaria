<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/client.js'
import { NOMS_ROLES } from '../api/droits.js'
import { utiliserEnvoi } from '../composables/envoi.js'
import { moi } from '../session.js'

const router = useRouter()

const actuel = ref('')
const nouveau = ref('')
const confirmation = ref('')
const change = ref(false)
const motDePasse = utiliserEnvoi()
const differents = computed(() => confirmation.value.length > 0 && confirmation.value !== nouveau.value)

const suppressionDemandee = ref(false)
const motDePasseSuppression = ref('')
const suppression = utiliserEnvoi()
const proprietaire = computed(() => moi.value.campagnes.some((c) => c.role === 'proprietaire'))

function changerMotDePasse() {
  if (differents.value) return undefined
  return motDePasse.envoyer(async () => {
    await api.changerMotDePasse(actuel.value, nouveau.value)
    actuel.value = ''
    nouveau.value = ''
    confirmation.value = ''
    change.value = true
  })
}

function supprimer() {
  return suppression.envoyer(async () => {
    await api.supprimerCompte(motDePasseSuppression.value)
    await router.replace({ name: 'connexion' })
    moi.value = null
  })
}
</script>

<template>
  <main class="page-feuille">
    <section class="feuille papier epingle" aria-labelledby="titre">
      <p class="surtitre petites-capitales">Mon compte</p>
      <h1 id="titre">{{ moi.identifiant }}</h1>
      <ul class="campagnes">
        <li v-for="c in moi.campagnes" :key="c.id">{{ c.nom }} — {{ NOMS_ROLES[c.role] }}</li>
      </ul>

      <h2>Changer de mot de passe</h2>
      <form @submit.prevent="changerMotDePasse">
        <input type="text" name="username" autocomplete="username" :value="moi.identifiant" hidden readonly>
        <label class="champ">Mot de passe actuel
          <input v-model="actuel" type="password" autocomplete="current-password" required>
        </label>
        <label class="champ">Nouveau mot de passe (12 caractères minimum)
          <input v-model="nouveau" type="password" autocomplete="new-password" minlength="12" required @input="change = false">
        </label>
        <label class="champ">Confirme le nouveau mot de passe
          <input v-model="confirmation" type="password" autocomplete="new-password" minlength="12" required :aria-invalid="differents">
        </label>
        <p v-if="differents" class="message message--erreur">Les deux mots de passe ne correspondent pas.</p>
        <p v-if="motDePasse.erreur.value" class="message message--erreur" role="alert">{{ motDePasse.erreur.value }}</p>
        <p v-if="change" class="message message--ok" role="status">Mot de passe changé. Tes autres appareils ont été déconnectés.</p>
        <div class="actions">
          <button type="submit" class="bouton bouton--plein" :disabled="motDePasse.enCours.value || differents">Changer le mot de passe</button>
        </div>
      </form>

      <h2>Mes données</h2>
      <p>Télécharge tout ce que le site sait de toi, dans un fichier lisible (format JSON).</p>
      <div class="actions"><a class="bouton" href="/api/moi/export" download="eldaria-mes-donnees.json">Télécharger mes données</a></div>

      <h2>Supprimer mon compte</h2>
      <p v-if="proprietaire" class="chapeau">Tu es MJ principal d'une campagne : ton compte ne peut pas être supprimé tant qu'elle existe.</p>
      <template v-else>
        <p>Ton compte, tes sessions et ta place dans chaque campagne seront effacés définitivement.</p>
        <div v-if="!suppressionDemandee" class="actions">
          <button type="button" class="bouton bouton--rouge" @click="suppressionDemandee = true">Supprimer mon compte…</button>
        </div>
        <form v-else @submit.prevent="supprimer">
          <label class="champ">Confirme avec ton mot de passe
            <input v-model="motDePasseSuppression" type="password" autocomplete="current-password" required>
          </label>
          <p v-if="suppression.erreur.value" class="message message--erreur" role="alert">{{ suppression.erreur.value }}</p>
          <div class="actions">
            <button type="submit" class="bouton bouton--rouge" :disabled="suppression.enCours.value">Supprimer définitivement</button>
            <button type="button" class="lien-bouton" @click="suppressionDemandee = false">Annuler</button>
          </div>
        </form>
      </template>
    </section>
  </main>
</template>

<style scoped>
.campagnes { margin: 0; padding-left: 1.2rem; color: var(--encre-2); }
</style>
