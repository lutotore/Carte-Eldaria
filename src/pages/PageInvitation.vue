<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { api } from '../api/client.js'
import { NOMS_ROLES } from '../api/droits.js'
import { utiliserEnvoi } from '../composables/envoi.js'
import { chargerMoi, moi, ouvrirSession } from '../session.js'

const props = defineProps({ jeton: { type: String, required: true } })
const router = useRouter()

const invitation = ref(null)
const erreurLien = ref('')
const nouveauCompte = ref(true)
const identifiant = ref('')
const motDePasse = ref('')
const confirmation = ref('')
const { enCours, erreur, envoyer } = utiliserEnvoi()

const differents = computed(() => confirmation.value.length > 0 && confirmation.value !== motDePasse.value)

onMounted(async () => {
  try {
    invitation.value = await api.lireInvitation(props.jeton)
    await chargerMoi().catch(() => {})
    nouveauCompte.value = !moi.value
  } catch (e) {
    erreurLien.value = e.message
  }
})

function rejoindre() {
  if (nouveauCompte.value && differents.value) return undefined
  return envoyer(async () => {
    const compte = nouveauCompte.value ? { identifiant: identifiant.value.trim(), motDePasse: motDePasse.value } : {}
    const profil = await api.accepterInvitation(props.jeton, compte)
    ouvrirSession(profil)
    const campagne = profil.campagnes.at(-1)
    await router.replace(campagne ? { name: 'carte', params: { id: campagne.id } } : '/')
  })
}
</script>

<template>
  <main class="page-feuille">
    <section class="feuille papier epingle" aria-labelledby="titre">
      <p class="surtitre petites-capitales">Lettre d'engagement</p>
      <h1 id="titre">Invitation</h1>

      <template v-if="erreurLien">
        <p class="message message--erreur" role="alert">{{ erreurLien }}</p>
        <p><RouterLink to="/connexion">Aller à la page de connexion</RouterLink></p>
      </template>

      <template v-else-if="invitation">
        <p>Tu es invité·e à rejoindre la campagne <strong>{{ invitation.campagne }}</strong> en tant que <strong>{{ NOMS_ROLES[invitation.role] }}</strong>.</p>

        <form @submit.prevent="rejoindre">
          <template v-if="moi && !nouveauCompte">
            <p>Tu es connecté·e en tant que <strong>{{ moi.identifiant }}</strong>.</p>
            <div class="actions">
              <button type="submit" class="bouton bouton--plein bouton--grand" :disabled="enCours">Rejoindre avec ce compte</button>
              <button type="button" class="lien-bouton" @click="nouveauCompte = true">Créer un autre compte</button>
            </div>
          </template>

          <template v-else>
            <label class="champ">Identifiant (3 à 32 caractères : lettres sans accent, chiffres, . _ -)
              <input v-model="identifiant" type="text" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="32" pattern="[A-Za-z0-9._\-]{3,32}" required>
            </label>
            <label class="champ">Mot de passe (12 caractères minimum ; une courte phrase fait très bien l'affaire)
              <input v-model="motDePasse" type="password" name="new-password" autocomplete="new-password" minlength="12" required>
            </label>
            <label class="champ">Confirme le mot de passe
              <input v-model="confirmation" type="password" autocomplete="new-password" minlength="12" required :aria-invalid="differents">
            </label>
            <p v-if="differents" class="message message--erreur">Les deux mots de passe ne correspondent pas.</p>
            <div class="actions">
              <button type="submit" class="bouton bouton--plein bouton--grand" :disabled="enCours || differents">Créer mon compte et rejoindre</button>
              <button v-if="moi" type="button" class="lien-bouton" @click="nouveauCompte = false">Utiliser mon compte {{ moi.identifiant }}</button>
            </div>
          </template>

          <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
        </form>

        <p class="chapeau">Ton identifiant et tes accès sont traités comme décrit dans la <RouterLink to="/confidentialite">politique de confidentialité</RouterLink>. Aucune adresse e-mail n'est demandée.</p>
      </template>

      <p v-else class="chapeau">Lecture de l'invitation…</p>
    </section>
  </main>
</template>
