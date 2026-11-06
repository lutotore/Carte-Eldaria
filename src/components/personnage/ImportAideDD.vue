<script setup>
import { computed, ref } from 'vue'
import { api } from '../../api/client.js'
import { differencesImport, ficheDepuisAideDD } from '../../domain/aideDD.js'
import { ficheVierge } from '../../domain/personnage.js'
import { utiliserEnvoi } from '../../composables/envoi.js'

/**
 * Import d'un personnage exporté par aide-dd.org (fichier XML) : on lit le fichier dans le navigateur,
 * on montre ce qui va changer, et rien n'est enregistré avant que le joueur confirme.
 * Sans fiche existante, l'import la crée. La bourse, l'inventaire et les Marques du Rêve ne sont jamais touchés.
 */
const props = defineProps({
  campagneId: { type: String, required: true },
  personnage: { type: Object, default: null },
})
const emit = defineEmits(['importe'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const ouvert = ref(false)
const lecture = ref('')
const import_ = ref(null)

const ficheActuelle = computed(() => props.personnage?.fiche ?? ficheVierge(''))
const differences = computed(() => (import_.value ? differencesImport(ficheActuelle.value, import_.value.champs) : []))

async function choisir(evenement) {
  lecture.value = ''
  import_.value = null
  const fichier = evenement.target.files?.[0]
  evenement.target.value = ''
  if (!fichier) return
  if (fichier.size > 512 * 1024) {
    lecture.value = 'Ce fichier est trop gros pour un export aide-dd.'
    return
  }
  try {
    import_.value = ficheDepuisAideDD(await fichier.text())
  } catch (e) {
    lecture.value = e.message
  }
}

const annuler = () => {
  import_.value = null
  lecture.value = ''
  ouvert.value = false
}

const confirmer = () => envoyer(async () => {
  const { champs } = import_.value
  let personnageId = props.personnage?.id
  if (!personnageId) ({ personnageId } = await api.creerPersonnage(props.campagneId, champs.nom))
  await api.modifierPersonnage(props.campagneId, personnageId, champs)
  annuler()
  emit('importe', personnageId)
})
</script>

<template>
  <section class="import-aide-dd">
    <button v-if="!ouvert" type="button" class="lien-bouton" @click="ouvert = true">Importer un personnage d’aide-dd…</button>
    <div v-else class="papier boite">
      <h2>Importer depuis aide-dd</h2>
      <p class="chapeau">
        Choisis le fichier XML enregistré depuis le créateur de personnages d’aide-dd.org.
        Rien n’est enregistré avant que tu confirmes.
      </p>
      <label class="champ">Fichier XML <input type="file" accept=".xml,text/xml,application/xml" @change="choisir"></label>
      <p v-if="lecture" class="message message--erreur" role="alert">{{ lecture }}</p>

      <template v-if="import_">
        <p v-if="differences.length === 0">Ta fiche est déjà à jour : rien ne changerait.</p>
        <table v-else class="apercu">
          <caption>Ce qui va changer</caption>
          <thead><tr><th scope="col">Champ</th><th scope="col">Aujourd’hui</th><th scope="col">Après l’import</th></tr></thead>
          <tbody>
            <tr v-for="d in differences" :key="d.cle">
              <th scope="row">{{ d.libelle }}</th>
              <td class="avant">{{ d.avant || '—' }}</td>
              <td>{{ d.apres }}</td>
            </tr>
          </tbody>
        </table>
        <ul class="avertissements">
          <li v-for="a in import_.avertissements" :key="a">{{ a }}</li>
        </ul>
        <div class="actions">
          <button type="button" class="bouton bouton--plein" :disabled="enCours || differences.length === 0" @click="confirmer">
            {{ personnage ? 'Remplacer ces champs' : 'Créer ma fiche depuis ce fichier' }}
          </button>
          <button type="button" class="lien-bouton" @click="annuler">Annuler</button>
        </div>
      </template>
      <button v-else type="button" class="lien-bouton" @click="annuler">Fermer</button>
      <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
    </div>
  </section>
</template>

<style scoped>
.import-aide-dd { display: flex; flex-direction: column; }
.import-aide-dd > .lien-bouton { align-self: flex-end; color: #cdb48c; }
.boite { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.7rem; }
.boite h2 { margin: 0; }
.chapeau { margin: 0; }
.apercu { border-collapse: collapse; width: 100%; font-size: 0.95rem; }
.apercu caption { text-align: left; font-weight: bold; margin-bottom: 0.3rem; }
.apercu th, .apercu td { border-bottom: 1px solid rgba(90, 60, 30, 0.3); padding: 0.3rem 0.5rem; text-align: left; vertical-align: top; white-space: pre-line; }
.avant { color: #7a6450; text-decoration: line-through; }
.avertissements { margin: 0; padding-left: 1.2rem; font-size: 0.92rem; font-style: italic; }
.actions { display: flex; gap: 0.8rem; align-items: center; }
</style>
