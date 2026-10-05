<script setup>
import { ref } from 'vue'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'

/** Les Marques du Rêve : un MJ les inscrit au moment où elles sont découvertes ; le joueur les lit. */
const props = defineProps({
  campagneId: { type: String, required: true },
  personnageId: { type: Number, required: true },
  marques: { type: Array, required: true },
  estMj: { type: Boolean, default: false },
})
const emit = defineEmits(['recharger'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const vierge = () => ({ titre: '', don: '', prix: '' })
const nouvelle = ref(vierge())
const edition = ref(null)
const confirmer = ref(null)

const agir = (action) => envoyer(async () => {
  await action()
  emit('recharger')
})
const inscrire = () => agir(async () => {
  await api.ajouterMarque(props.campagneId, props.personnageId, nouvelle.value)
  nouvelle.value = vierge()
})
const enregistrer = () => agir(async () => {
  const { id, titre, don, prix } = edition.value
  await api.modifierMarque(props.campagneId, props.personnageId, id, { titre, don, prix })
  edition.value = null
})
const effacer = (marque) => agir(async () => {
  await api.supprimerMarque(props.campagneId, props.personnageId, marque.id)
  confirmer.value = null
})
</script>

<template>
  <section class="marques papier" aria-labelledby="titre-marques">
    <h2 id="titre-marques">Marques du Rêve</h2>
    <p v-if="!marques.length" class="vide">{{ estMj ? 'Aucune Marque. Inscris-la ici au moment où le personnage la reçoit : le joueur sera prévenu.' : 'Aucune Marque… pour l’instant.' }}</p>

    <article v-for="m in marques" :key="m.id" class="marque">
      <template v-if="edition?.id === m.id">
        <form class="formulaire" @submit.prevent="enregistrer">
          <label class="champ">Nom <input v-model="edition.titre" maxlength="120" required></label>
          <label class="champ">Don <textarea v-model="edition.don" rows="2" maxlength="4000" /></label>
          <label class="champ">Prix <textarea v-model="edition.prix" rows="2" maxlength="4000" /></label>
          <div class="actions">
            <button type="submit" class="bouton bouton--plein" :disabled="enCours">Enregistrer</button>
            <button type="button" class="lien-bouton" @click="edition = null">Annuler</button>
          </div>
        </form>
      </template>
      <template v-else>
        <h3>{{ m.titre }}</h3>
        <p v-if="m.don"><strong>Don.</strong> {{ m.don }}</p>
        <p v-if="m.prix"><strong>Prix.</strong> {{ m.prix }}</p>
        <div v-if="estMj" class="actions">
          <button type="button" class="lien-bouton" @click="edition = { ...m }">Modifier</button>
          <button v-if="confirmer !== m.id" type="button" class="lien-bouton effacer" @click="confirmer = m.id">Effacer…</button>
          <span v-else class="confirmer">
            Effacer cette Marque ?
            <button type="button" class="bouton bouton--rouge" :disabled="enCours" @click="effacer(m)">Oui</button>
            <button type="button" class="lien-bouton" @click="confirmer = null">Non</button>
          </span>
        </div>
      </template>
    </article>

    <form v-if="estMj" class="formulaire nouvelle" @submit.prevent="inscrire">
      <h3>Inscrire une Marque</h3>
      <label class="champ">Nom <input v-model="nouvelle.titre" maxlength="120" required placeholder="La Marque du Cœur"></label>
      <label class="champ">Don <textarea v-model="nouvelle.don" rows="2" maxlength="4000" /></label>
      <label class="champ">Prix <textarea v-model="nouvelle.prix" rows="2" maxlength="4000" /></label>
      <button type="submit" class="bouton" :disabled="enCours">Inscrire sur la fiche</button>
    </form>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
  </section>
</template>

<style scoped>
.marques { padding: 1.2rem 1.2rem 1rem; display: flex; flex-direction: column; gap: 0.7rem; }
h2 { font-size: 1.35rem; }
h3 { font-size: 1.15rem; }
.vide { margin: 0; font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
.marque { padding: 0.6rem 0.8rem; border-left: 3px solid var(--cristal, #4b6a8a); background: rgba(75, 106, 138, 0.07); display: flex; flex-direction: column; gap: 0.25rem; }
.marque p { margin: 0; line-height: 1.45; white-space: pre-line; }
.actions { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
.effacer { color: var(--rouge); }
.confirmer { display: inline-flex; gap: 0.4rem; align-items: center; color: var(--rouge); font-size: var(--t-s); }
.formulaire { display: flex; flex-direction: column; gap: 0.4rem; align-items: stretch; }
.formulaire .bouton { align-self: flex-start; }
.nouvelle { border-top: 1px dashed var(--papier-ombre); padding-top: 0.6rem; }
</style>
