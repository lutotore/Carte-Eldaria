<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import {
  actifSurCetAppareil, activerSurCetAppareil, couperSurCetAppareil, doitInstallerSurIos, estInstalle, pushPossible,
} from '../../composables/push.js'

/** « Mon compte » : notifications sur les appareils (push) et ce que chacun veut y recevoir. */
const reglages = ref(null)
const actifIci = ref(false)
const fait = ref('')
const { enCours, erreur, envoyer } = utiliserEnvoi()

const possible = pushPossible()
const installerSurIos = doitInstallerSurIos(navigator.userAgent, estInstalle(), navigator.maxTouchPoints)
const bloque = computed(() => possible && Notification.permission === 'denied')

async function lire() {
  reglages.value = await api.reglagesPush()
  actifIci.value = await actifSurCetAppareil().catch(() => false)
}
onMounted(() => envoyer(lire))

const agir = (action, message) => envoyer(async () => {
  fait.value = ''
  await action()
  await lire()
  fait.value = message
})
const activer = () => agir(() => activerSurCetAppareil(reglages.value.cle), 'Notifications activées sur cet appareil.')
const couper = () => agir(couperSurCetAppareil, 'Notifications coupées sur cet appareil.')
const retirer = (appareil) => agir(() => api.retirerAppareilPush(appareil.id), 'Appareil retiré.')

function basculer(categorie, actif) {
  const actives = reglages.value.preferences.filter((c) => (c.cle === categorie.cle ? actif : c.actif)).map((c) => c.cle)
  return agir(() => api.changerPreferencesPush(actives), 'Choix enregistré.')
}

const date = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'jamais')
</script>

<template>
  <section class="notifications" aria-labelledby="titre-notifications">
    <h2 id="titre-notifications">Notifications</h2>
    <p class="chapeau">La cloche du portail garde toutes les notifications. Tu peux aussi les recevoir sur ton téléphone ou ton ordinateur, même site fermé.</p>

    <div class="appareil-ici">
      <template v-if="installerSurIos">
        <p class="message message--info">
          Sur iPhone et iPad, ajoute d’abord le portail à ton écran d’accueil : dans Safari, touche <strong>Partager</strong>,
          puis <strong>Sur l’écran d’accueil</strong>. Ouvre ensuite Eldaria depuis cette icône et reviens ici.
        </p>
      </template>
      <p v-else-if="!possible" class="message message--info">Ce navigateur ne sait pas recevoir de notifications. Essaie avec Chrome, Firefox, Edge ou Safari à jour.</p>
      <p v-else-if="bloque" class="message message--info">Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur (le cadenas à côté de l’adresse), puis recharge la page.</p>
      <template v-else-if="reglages">
        <p v-if="actifIci" class="etat-ok">Cet appareil reçoit les notifications.</p>
        <button v-if="!actifIci" type="button" class="bouton bouton--plein" :disabled="enCours" @click="activer">Activer sur cet appareil</button>
        <button v-else type="button" class="bouton" :disabled="enCours" @click="couper">Couper sur cet appareil</button>
      </template>
    </div>

    <fieldset v-if="reglages" class="categories">
      <legend>Ce que je reçois sur mes appareils</legend>
      <label v-for="c in reglages.preferences" :key="c.cle" class="categorie">
        <input type="checkbox" :checked="c.actif" :disabled="enCours" @change="basculer(c, $event.target.checked)">
        <span><strong>{{ c.nom }}</strong><small>{{ c.description }}</small></span>
      </label>
    </fieldset>

    <div v-if="reglages?.appareils.length" class="appareils">
      <h3>Mes appareils</h3>
      <ul>
        <li v-for="a in reglages.appareils" :key="a.id">
          <span><strong>{{ a.appareil || 'Appareil' }}</strong><small>ajouté le {{ date(a.creeLe) }} · dernière notification : {{ date(a.dernierEnvoiLe) }}</small></span>
          <button type="button" class="lien-bouton retirer" :disabled="enCours" @click="retirer(a)">Retirer</button>
        </li>
      </ul>
    </div>

    <p class="statut" aria-live="polite">
      <span v-if="erreur" class="message message--erreur">{{ erreur }}</span>
      <span v-else-if="fait" class="message message--ok">{{ fait }}</span>
    </p>
  </section>
</template>

<style scoped>
.notifications { display: flex; flex-direction: column; gap: 0.8rem; }
.appareil-ici { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
.etat-ok { margin: 0; color: var(--vert); font-weight: 700; }
.message--info { color: var(--encre); border-color: var(--laiton); background: rgba(201, 162, 86, 0.12); }
.categories { margin: 0; padding: 0.6rem 0.8rem; border: 1px solid var(--papier-ombre); border-radius: 4px; display: flex; flex-direction: column; gap: 0.5rem; }
.categories legend { font-family: var(--f-titre); font-size: 1.05rem; padding: 0 0.3rem; }
.categorie { display: flex; gap: 0.6rem; align-items: flex-start; }
.categorie input { margin-top: 0.3rem; }
.categorie span, .appareils span { display: flex; flex-direction: column; }
.categorie small, .appareils small { color: var(--encre-2); font-size: var(--t-s); }
.appareils h3 { font-size: 1.1rem; }
.appareils ul { list-style: none; margin: 0.3rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.appareils li { display: flex; justify-content: space-between; gap: 0.8rem; align-items: center; }
.retirer { color: var(--rouge); }
.statut { margin: 0; min-height: 1.4rem; }
.statut .message { display: block; }
</style>
