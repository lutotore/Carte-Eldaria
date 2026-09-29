<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api/client.js'
import Atlas from '../components/Atlas.vue'
import { changerActe, changerSession, publierNouvelle, retirerAlerte, versPublic } from '../domain/index.js'
import { NOMS_ACTE } from '../composables/format.js'
import PanneauHorloge from './panneaux/PanneauHorloge.vue'
import PanneauCroyances from './panneaux/PanneauCroyances.vue'
import PanneauSuivi from './panneaux/PanneauSuivi.vue'
import PanneauIles from './panneaux/PanneauIles.vue'
import PanneauMissions from './panneaux/PanneauMissions.vue'
import PanneauNouvelles from './panneaux/PanneauNouvelles.vue'
import PanneauJournal from './panneaux/PanneauJournal.vue'
import './mj.css'

const props = defineProps({ id: { type: String, required: true } })

const ONGLETS = [
  { cle: 'horloge', nom: "Horloge d'Éveil", composant: PanneauHorloge },
  { cle: 'croyances', nom: 'Croyances', composant: PanneauCroyances },
  { cle: 'suivi', nom: 'Factions et personnages', composant: PanneauSuivi },
  { cle: 'iles', nom: 'Îles', composant: PanneauIles },
  { cle: 'missions', nom: 'Missions', composant: PanneauMissions },
  { cle: 'nouvelles', nom: 'Nouvelles', composant: PanneauNouvelles },
  { cle: 'journal', nom: 'Journal', composant: PanneauJournal },
]

const etat = ref(null)
const erreurChargement = ref('')
const message = ref('')
const statut = ref('')
const pile = ref([])
const onglet = ref('horloge')
const panneau = computed(() => ONGLETS.find((o) => o.cle === onglet.value).composant)
const publique = computed(() => (etat.value ? versPublic(etat.value) : null))

onMounted(async () => {
  try {
    etat.value = await api.etat(props.id)
  } catch (erreur) {
    erreurChargement.value = erreur.code === 'introuvable'
      ? "Le monde de cette campagne n'a pas encore été importé. Voir « Importer ton monde » dans le README."
      : erreur.message
  }
})

// Les modifications rapprochées sont regroupées : un seul envoi après 400 ms de calme.
let minuteur = null
function enregistrer() {
  statut.value = 'Enregistrement…'
  clearTimeout(minuteur)
  minuteur = setTimeout(async () => {
    try {
      await api.enregistrerEtat(props.id, etat.value)
      statut.value = 'Enregistré. Les joueurs voient les changements en rechargeant la carte.'
    } catch (erreur) {
      statut.value = `Échec de l'enregistrement : ${erreur.message}`
    }
  }, 400)
}

/** Point d'entrée unique des modifications : applique une transformation pure de l'état. */
function agir(transformation) {
  message.value = ''
  try {
    const suivant = transformation(etat.value)
    if (!suivant || suivant === etat.value) return
    pile.value = [...pile.value, etat.value].slice(-30)
    etat.value = suivant
    enregistrer()
  } catch (erreur) {
    message.value = erreur.message
  }
}

function annuler() {
  const precedent = pile.value.at(-1)
  if (!precedent) return
  pile.value = pile.value.slice(0, -1)
  etat.value = precedent
  enregistrer()
}

const publierAlerte = (index) => agir((e) => retirerAlerte(publierNouvelle(e, e.alertes[index].nouvelle), index))
const classerAlerte = (index) => agir((e) => retirerAlerte(e, index))
</script>

<template>
  <main v-if="erreurChargement" class="mj">
    <h1>Table du MJ</h1>
    <p class="mj-erreur">{{ erreurChargement }}</p>
  </main>

  <template v-else-if="etat">
    <Atlas :monde="publique" mention-mj />
    <section class="mj" aria-labelledby="titre-mj">
      <div class="mj-bandeau">
        <div>
          <p class="petites-capitales">Visible uniquement des MJ</p>
          <h2 id="titre-mj">Table du MJ</h2>
        </div>
        <div class="mj-reglages">
          <label class="champ">Acte
            <select :value="etat.acte" @change="agir((e) => changerActe(e, $event.target.value))">
              <option v-for="(n, i) in NOMS_ACTE" :key="n" :value="i + 1">{{ n }}</option>
            </select>
          </label>
          <label class="champ">Session en cours
            <input type="text" :value="etat.session" @change="agir((e) => changerSession(e, $event.target.value))">
          </label>
          <button type="button" class="bouton" :disabled="!pile.length" @click="annuler">Annuler la dernière action</button>
        </div>
      </div>
      <p class="mj-statut" aria-live="polite">{{ statut }}<span v-if="message" class="mj-erreur"> {{ message }}</span></p>

      <div v-if="etat.alertes?.length" class="alertes papier" role="status">
        <div v-for="(a, i) in etat.alertes" :key="`${a.titre}-${i}`" class="alerte">
          <div><strong>{{ a.titre }}</strong><span>{{ a.mj }}</span></div>
          <div class="actions">
            <button v-if="a.nouvelle" type="button" class="bouton bouton--plein" @click="publierAlerte(i)">Publier la nouvelle</button>
            <button type="button" class="bouton" @click="classerAlerte(i)">C'est noté</button>
          </div>
        </div>
      </div>

      <div class="pupitre papier">
        <div class="mj-onglets" role="tablist" aria-label="Sections de la table du MJ">
          <button v-for="o in ONGLETS" :key="o.cle" type="button" role="tab" :aria-selected="onglet === o.cle" @click="onglet = o.cle">{{ o.nom }}</button>
        </div>
        <component :is="panneau" :etat="etat" @agir="agir" />
      </div>
    </section>
  </template>

  <main v-else class="mj"><p class="mj-statut">Ouverture de la table du MJ…</p></main>
</template>
