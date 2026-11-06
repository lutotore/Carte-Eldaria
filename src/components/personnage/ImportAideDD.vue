<script setup>
import { computed, ref } from 'vue'
import { api } from '../../api/client.js'
import { differencesImport, ficheDepuisAideDD, reglesDepuisAideDD } from '../../domain/aideDD.js'
import { ficheVierge } from '../../domain/personnage.js'
import { utiliserEnvoi } from '../../composables/envoi.js'

/**
 * Import d'un personnage exporté par aide-dd.org (fichier XML) : on lit le fichier dans le navigateur,
 * on montre ce qui va changer, et rien n'est enregistré avant que le joueur confirme.
 * Sans fiche existante, l'import la crée. La bourse, l'inventaire et les Marques du Rêve ne sont jamais touchés.
 * Une fiche qui ne suit pas encore les règles du site y est rattachée quand la classe (et la sous-classe) sont reconnues.
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
const texteXml = ref('')
/** Ce que l'import fera côté règles : rattachement reconnu, ou pourquoi il n'aura pas lieu. Null si la fiche suit déjà les règles. */
const regles = ref(null)

const ficheActuelle = computed(() => props.personnage?.fiche ?? ficheVierge(''))
/** Sur une fiche qui suit les règles, la montée de niveau garde la main sur la classe, le niveau et les dés de vie. */
const TENUS_PAR_LES_REGLES = ['classe', 'niveau', 'desDeVie']
const champsImportes = computed(() => {
  if (!import_.value) return {}
  if (!ficheActuelle.value.regles) return import_.value.champs
  return Object.fromEntries(Object.entries(import_.value.champs).filter(([cle]) => !TENUS_PAR_LES_REGLES.includes(cle)))
})
const avertissements = computed(() => [
  ...(import_.value?.avertissements ?? []),
  ...(ficheActuelle.value.regles ? ['Ta fiche suit les règles du site : la classe, le niveau et les dés de vie ne sont pas repris.'] : []),
])
const differences = computed(() => (import_.value ? differencesImport(ficheActuelle.value, champsImportes.value) : []))

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
    texteXml.value = await fichier.text()
    import_.value = ficheDepuisAideDD(texteXml.value)
    regles.value = await reglesPrevues()
  } catch (e) {
    lecture.value = e.message
  }
}

/** Seulement pour une fiche existante et libre : pour une fiche à créer, le rattachement se tente après la création. */
async function reglesPrevues() {
  if (!props.personnage || props.personnage.fiche.regles) return null
  const { rattachement } = await api.reglesPersonnage(props.campagneId, props.personnage.id)
  return rattachement ? reglesDepuisAideDD(texteXml.value, rattachement) : null
}

async function rattacherSiPossible(personnageId) {
  if (props.personnage?.fiche.regles) return
  const { rattachement } = await api.reglesPersonnage(props.campagneId, personnageId)
  if (!rattachement) return
  const { demande } = reglesDepuisAideDD(texteXml.value, rattachement)
  if (demande) await api.rattacherAuxRegles(props.campagneId, personnageId, demande)
}

const annuler = () => {
  import_.value = null
  regles.value = null
  texteXml.value = ''
  lecture.value = ''
  ouvert.value = false
}

const confirmer = () => envoyer(async () => {
  const champs = champsImportes.value
  let personnageId = props.personnage?.id
  if (!personnageId) ({ personnageId } = await api.creerPersonnage(props.campagneId, champs.nom))
  await api.modifierPersonnage(props.campagneId, personnageId, champs)
  await rattacherSiPossible(personnageId)
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
          <li v-for="a in avertissements" :key="a">{{ a }}</li>
          <li v-for="a in regles?.avertissements ?? []" :key="a">{{ a }}</li>
        </ul>
        <p v-if="regles?.demande" class="rattachement">
          La fiche suivra aussi les règles du site, pour monter de niveau ici.
        </p>
        <div class="actions">
          <button type="button" class="bouton bouton--plein" :disabled="enCours || (differences.length === 0 && !regles?.demande)" @click="confirmer">
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
