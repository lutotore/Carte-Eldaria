<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { api } from '../api/client.js'

const route = useRoute()
const ouverte = ref(false)
const nonLues = ref(0)
const liste = ref([])

async function charger() {
  try {
    const reponse = await api.notifications()
    nonLues.value = reponse.nonLues
    liste.value = reponse.liste
  } catch {
    // Sans réseau, la cloche garde son dernier état : rien d'urgent à signaler.
  }
}

async function basculer() {
  ouverte.value = !ouverte.value
  if (ouverte.value && nonLues.value > 0) {
    await api.marquerNotificationsLues().catch(() => {})
    nonLues.value = 0
  }
}

const quand = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Nouvelle vérification à chaque page, toutes les minutes et au retour sur l'onglet.
let minuteur = null
const auRetour = () => document.visibilityState === 'visible' && charger()
onMounted(() => {
  charger()
  minuteur = setInterval(charger, 60_000)
  document.addEventListener('visibilitychange', auRetour)
})
onBeforeUnmount(() => {
  clearInterval(minuteur)
  document.removeEventListener('visibilitychange', auRetour)
})
watch(() => route.fullPath, () => { ouverte.value = false; charger() })
</script>

<template>
  <div class="cloche">
    <button type="button" class="bouton-cloche" :aria-expanded="ouverte" aria-controls="liste-notifications" @click="basculer">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6Zm-2 15a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>
      <span class="visuellement-cache">Notifications</span>
      <span v-if="nonLues" class="pastille">{{ nonLues }}<span class="visuellement-cache"> non lue(s)</span></span>
    </button>
    <div v-if="ouverte" id="liste-notifications" class="liste papier">
      <p v-if="!liste.length" class="vide">Aucune notification.</p>
      <ul v-else>
        <li v-for="n in liste" :key="n.id" :class="{ nouvelle: !n.lue }">
          <RouterLink :to="n.lien">{{ n.texte }}</RouterLink>
          <time :datetime="n.creeLe">{{ quand(n.creeLe) }}</time>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.cloche { position: relative; }
.bouton-cloche { position: relative; display: inline-flex; background: none; border: 0; padding: 0.2rem; color: #e8d6b0; }
.bouton-cloche:hover { color: var(--laiton-clair); }
.pastille {
  position: absolute; top: -0.35rem; right: -0.45rem; min-width: 1.15rem; height: 1.15rem; padding: 0 0.25rem;
  border-radius: 999px; background: var(--rouge); color: #f6e7cf; font-size: 0.7rem; font-weight: 700; line-height: 1.15rem; text-align: center;
}
.liste { position: absolute; right: 0; top: 2.2rem; z-index: 20; width: min(22rem, calc(100vw - 32px)); padding: 0.4rem 0; max-height: 70vh; overflow-y: auto; }
.liste ul { list-style: none; margin: 0; padding: 0; }
.liste li { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.55rem 1rem; border-bottom: 1px dashed var(--papier-ombre); }
.liste li:last-child { border-bottom: 0; }
.liste li.nouvelle { border-left: 3px solid var(--rouge); padding-left: calc(1rem - 3px); }
.liste a { color: var(--encre); text-decoration: none; }
.liste a:hover { text-decoration: underline; }
.liste time { font-size: var(--t-xs); color: var(--encre-2); }
/* Sur téléphone, la barre passe sur deux lignes et la cloche se retrouve à gauche. */
@media (max-width: 700px) { .liste { right: auto; left: 0; } }
.vide { margin: 0; padding: 0.6rem 1rem; color: var(--encre-2); font-style: italic; }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
