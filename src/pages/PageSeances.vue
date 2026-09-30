<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../api/client.js'
import { campagneDe, estMj as roleMj, repondAuxSondages } from '../api/droits.js'
import FormulaireSondage from '../components/seances/FormulaireSondage.vue'
import MesDisponibilites from '../components/seances/MesDisponibilites.vue'
import ProchaineSeance from '../components/seances/ProchaineSeance.vue'
import SyntheseSondage from '../components/seances/SyntheseSondage.vue'
import { utiliserEnvoi } from '../composables/envoi.js'
import { moi } from '../session.js'

const props = defineProps({ id: { type: String, required: true } })

const planning = ref(null)
const confirmation = ref('')
const { enCours, erreur, envoyer } = utiliserEnvoi()

const campagne = computed(() => campagneDe(moi.value, props.id))
const estMj = computed(() => roleMj(campagne.value))
const repond = computed(() => repondAuxSondages(campagne.value))

const charger = () => envoyer(async () => { planning.value = await api.planning(props.id) })
onMounted(charger)
watch(() => props.id, charger)

/** Exécute une action puis recharge la page, avec un message de confirmation. */
function agir(action, message) {
  confirmation.value = ''
  return envoyer(async () => {
    await action()
    planning.value = await api.planning(props.id)
    confirmation.value = message
  })
}

const ouvrir = (sondage) => agir(() => api.ouvrirSondage(props.id, sondage), 'Sondage ouvert : les joueurs ont été prévenus.')
const repondre = (reponses) => agir(() => api.repondre(props.id, planning.value.sondage.id, reponses), 'Tes disponibilités sont enregistrées.')
const fixer = ({ dateId, debut, fin, lieu }) => agir(() => api.fixerSeance(props.id, planning.value.sondage.id, { dateId, debut, fin, lieu }), 'Séance fixée : tout le monde a été prévenu.')
const annulerSondage = () => agir(() => api.annulerSondage(props.id, planning.value.sondage.id), 'Sondage annulé.')
const annulerSeance = () => agir(() => api.annulerSeance(props.id, planning.value.prochaineSeance.id), 'Séance annulée : tout le monde a été prévenu.')
</script>

<template>
  <main class="seances">
    <header class="entete">
      <h1>Séances</h1>
      <p v-if="confirmation" class="message message--ok" role="status">{{ confirmation }}</p>
      <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
    </header>

    <template v-if="planning">
      <ProchaineSeance v-if="planning.prochaineSeance" :seance="planning.prochaineSeance" :campagne="planning.campagne" :est-mj="estMj" :en-cours="enCours" @annuler="annulerSeance" />
      <p v-else-if="!planning.sondage" class="vide">Aucune séance n'est prévue pour l'instant.</p>

      <template v-if="planning.sondage">
        <MesDisponibilites v-if="repond" :sondage="planning.sondage" :moi-id="moi.id" :en-cours="enCours" @enregistrer="repondre" />
        <SyntheseSondage :sondage="planning.sondage" :est-mj="estMj" :en-cours="enCours" @fixer="fixer" @annuler="annulerSondage" />
      </template>
      <FormulaireSondage v-else-if="estMj" :en-cours="enCours" @ouvrir="ouvrir" />
    </template>
    <p v-else-if="!erreur" class="vide">Chargement…</p>
  </main>
</template>

<style scoped>
.seances { max-width: 980px; margin: 0 auto; padding: 1.5rem max(16px, env(safe-area-inset-left)) 2rem; display: flex; flex-direction: column; gap: 1.6rem; }
.entete { display: flex; flex-direction: column; gap: 0.6rem; }
h1 { font-size: clamp(2rem, 5vw, 2.8rem); color: var(--laiton-clair); text-shadow: 0 2px 2px rgba(0, 0, 0, 0.6); }
.entete .message { background: var(--papier); }
.vide { color: #cdb48c; font-style: italic; margin: 0; }
</style>
