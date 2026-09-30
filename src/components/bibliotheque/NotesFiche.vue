<script setup>
import { ref } from 'vue'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'

const props = defineProps({
  campagneId: { type: String, required: true },
  ficheId: { type: Number, required: true },
  notes: { type: Array, required: true },
  estMj: { type: Boolean, default: false },
  lectures: { type: Array, default: () => [] },
})
const emit = defineEmits(['recharger'])

const { enCours, erreur, envoyer } = utiliserEnvoi()
const brouillon = ref({ type: 'note', visibilite: 'privee', texte: '' })
const enEdition = ref(null)

const action = (travail) => envoyer(async () => { await travail(); emit('recharger') })
const ajouter = () => action(async () => {
  await api.ajouterNote(props.campagneId, props.ficheId, brouillon.value)
  brouillon.value = { ...brouillon.value, texte: '' }
})
const enregistrer = () => action(async () => {
  await api.modifierNote(props.campagneId, enEdition.value.id, enEdition.value.texte, enEdition.value.visibilite)
  enEdition.value = null
})
const supprimer = (note) => action(() => api.supprimerNote(props.campagneId, note.id))
const compter = (note, lecture) => action(() => api.compterCroyance(props.campagneId, note.id, lecture))

const nomLecture = (cle) => props.lectures.find((l) => l.cle === cle)?.nom ?? cle
const quand = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
</script>

<template>
  <section class="notes papier" aria-labelledby="titre-notes">
    <h2 id="titre-notes">{{ estMj ? 'Notes et croyances des joueurs' : 'Notes et croyances' }}</h2>
    <p v-if="estMj && lectures.length" class="aide">Compte une croyance dans le Registre des Croyances en un clic : elle y est ajoutée avec son texte.</p>
    <p v-if="!notes.length" class="aide">Rien pour l'instant.</p>

    <ul class="liste">
      <li v-for="n in notes" :key="n.id" :class="['note', `note--${n.type}`]">
        <div class="meta">
          <span class="type">{{ n.type === 'croyance' ? 'Croyance' : 'Note' }}</span>
          <span>{{ n.mienne ? 'toi' : n.auteur }} · {{ n.visibilite === 'privee' ? 'privée' : 'partagée' }} · {{ quand(n.majLe) }}</span>
        </div>
        <template v-if="enEdition?.id === n.id">
          <textarea v-model="enEdition.texte" rows="3" maxlength="2000" aria-label="Texte de la note" />
          <div class="actions">
            <select v-model="enEdition.visibilite" aria-label="Visibilité"><option value="privee">Privée</option><option value="groupe">Partagée avec le groupe</option></select>
            <button type="button" class="bouton" :disabled="enCours" @click="enregistrer">Enregistrer</button>
            <button type="button" class="lien-bouton" @click="enEdition = null">Annuler</button>
          </div>
        </template>
        <template v-else>
          <p class="texte">{{ n.texte }}</p>
          <div class="actions">
            <button v-if="n.mienne" type="button" class="lien-bouton" @click="enEdition = { id: n.id, texte: n.texte, visibilite: n.visibilite }">Modifier</button>
            <button v-if="n.mienne || estMj" type="button" class="lien-bouton supprimer" :disabled="enCours" @click="supprimer(n)">Supprimer</button>
            <template v-if="estMj && n.type === 'croyance'">
              <span v-if="n.lectureComptee" class="comptee">Comptée : {{ nomLecture(n.lectureComptee) }}</span>
              <span v-else-if="lectures.length" class="compter">
                Compter pour :
                <button v-for="l in lectures" :key="l.cle" type="button" class="bouton" :disabled="enCours" @click="compter(n, l.cle)">{{ l.nom }}</button>
              </span>
            </template>
          </div>
        </template>
      </li>
    </ul>

    <form v-if="!estMj" class="ajout" @submit.prevent="ajouter">
      <div class="choix">
        <label><input v-model="brouillon.type" type="radio" value="note"> Note</label>
        <label><input v-model="brouillon.type" type="radio" value="croyance"> Croyance <small>(ce que tu penses de lui)</small></label>
      </div>
      <textarea v-model="brouillon.texte" rows="3" maxlength="2000" required :placeholder="brouillon.type === 'croyance' ? 'On pense qu’il ment sur…' : 'À retenir…'" aria-label="Texte" />
      <div class="choix">
        <label><input v-model="brouillon.visibilite" type="radio" value="privee"> Privée <small>(toi et les MJ)</small></label>
        <label><input v-model="brouillon.visibilite" type="radio" value="groupe"> Partagée avec le groupe</label>
      </div>
      <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
      <button type="submit" class="bouton bouton--plein" :disabled="enCours">Ajouter</button>
    </form>
    <p v-else-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
  </section>
</template>

<style scoped>
.notes { padding: 1.6rem 1.4rem 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; }
h2 { font-size: 1.45rem; color: var(--encre); }
.aide { margin: 0; font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
.liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.note { padding: 0.6rem 0.8rem; border-left: 3px solid var(--papier-ombre); background: rgba(255, 255, 255, 0.25); display: flex; flex-direction: column; gap: 0.3rem; }
.note--croyance { border-left-color: var(--cristal); }
.meta { display: flex; gap: 0.6rem; font-size: var(--t-xs); color: var(--encre-2); }
.type { font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; }
.texte { margin: 0; white-space: pre-line; }
.actions { display: flex; flex-wrap: wrap; gap: 0.4rem 0.9rem; align-items: center; font-size: var(--t-s); }
.compter { display: inline-flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.comptee { color: var(--vert); font-style: italic; }
.supprimer { color: var(--rouge); }
.ajout { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; border-top: 1px dashed var(--papier-ombre); padding-top: 0.8rem; }
.choix { display: flex; flex-wrap: wrap; gap: 0.3rem 1.2rem; }
.choix label { display: inline-flex; gap: 0.3rem; align-items: center; }
textarea, select { width: 100%; border: 1px solid var(--papier-ombre); border-radius: 3px; background: #f6ecd4; padding: 0.4rem 0.55rem; color: var(--encre); resize: vertical; }
select { width: auto; }
</style>
