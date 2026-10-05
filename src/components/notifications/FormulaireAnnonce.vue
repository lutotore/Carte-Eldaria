<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../../api/client.js'
import { NOMS_ROLES } from '../../api/droits.js'
import { utiliserEnvoi } from '../../composables/envoi.js'

/** Message libre d'un MJ : au groupe entier ou à certains membres. Il arrive sous la cloche et sur leurs appareils. */
const props = defineProps({ campagneId: { type: String, required: true }, moiId: { type: Number, required: true } })
const membres = ref([])
const texte = ref('')
const pourTous = ref(true)
const choisis = ref([])
const fait = ref('')
const { enCours, erreur, envoyer } = utiliserEnvoi()

onMounted(() => envoyer(async () => {
  membres.value = (await api.membres(props.campagneId)).filter((m) => m.id !== props.moiId)
}))

const envoyerMessage = () => envoyer(async () => {
  fait.value = ''
  const { destinataires } = await api.envoyerAnnonce(props.campagneId, texte.value, pourTous.value ? 'tous' : choisis.value)
  texte.value = ''
  choisis.value = []
  fait.value = `Message envoyé à ${destinataires} membre${destinataires > 1 ? 's' : ''}.`
})
</script>

<template>
  <section class="annonce papier" aria-labelledby="titre-annonce">
    <h2 id="titre-annonce">Envoyer un message</h2>
    <form @submit.prevent="envoyerMessage">
      <label class="champ">Message <textarea v-model="texte" rows="3" maxlength="500" required placeholder="On commence à 13 h samedi, apportez vos dés !" /></label>
      <fieldset class="destinataires">
        <legend>À qui</legend>
        <label><input v-model="pourTous" type="radio" :value="true" name="pour"> Tout le groupe</label>
        <label><input v-model="pourTous" type="radio" :value="false" name="pour"> Certains membres…</label>
        <div v-if="!pourTous" class="membres">
          <label v-for="m in membres" :key="m.id"><input v-model="choisis" type="checkbox" :value="m.id"> {{ m.identifiant }} <small>({{ NOMS_ROLES[m.role] }})</small></label>
        </div>
      </fieldset>
      <div class="actions">
        <button type="submit" class="bouton bouton--plein" :disabled="enCours || (!pourTous && !choisis.length)">Envoyer</button>
        <small>{{ texte.length }}/500</small>
      </div>
      <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
      <p v-else-if="fait" class="message message--ok" role="status">{{ fait }}</p>
    </form>
  </section>
</template>

<style scoped>
.annonce { padding: 1.2rem; display: flex; flex-direction: column; gap: 0.6rem; }
h2 { font-size: 1.35rem; }
form { display: flex; flex-direction: column; gap: 0.6rem; }
.destinataires { margin: 0; padding: 0; border: 0; display: flex; flex-wrap: wrap; gap: 0.4rem 1.2rem; }
.destinataires legend { font-size: var(--t-s); color: var(--encre-2); margin-bottom: 0.2rem; }
.membres { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; padding-left: 1.4rem; }
.membres small { color: var(--encre-2); }
.actions { display: flex; gap: 0.8rem; align-items: center; }
.actions small { color: var(--encre-2); }
</style>
