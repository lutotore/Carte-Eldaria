<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '../api/client.js'
import ButinJoueur from '../components/butins/ButinJoueur.vue'
import ButinMj from '../components/butins/ButinMj.vue'
import { utiliserEnvoi } from '../composables/envoi.js'
import { PIECES } from '../domain/personnage.js'

const props = defineProps({ id: { type: String, required: true } })

const donnees = ref(null)
const objetsBibliotheque = ref([])
const aUneFiche = ref(false)
const nouveauTitre = ref('')
const chargement = utiliserEnvoi()
const creation = utiliserEnvoi()

/** Chargement hors de `envoyer` côté recharge : une prise ne doit jamais laisser la page sur un état périmé. */
async function lire() {
  const butins = await api.butins(props.id)
  if (butins.estMj) objetsBibliotheque.value = (await api.bibliotheque(props.id, 'objet')).fiches
  else aUneFiche.value = (await api.personnages(props.id)).personnageId !== null
  donnees.value = butins
}
const charger = () => chargement.envoyer(lire)
const recharger = () => lire().catch((e) => { chargement.erreur.value = e.message })
onMounted(charger)
watch(() => props.id, () => { donnees.value = null; charger() })

const SECTIONS = [
  { statut: 'ouvert', titre: 'Ouverts aux joueurs' },
  { statut: 'prepare', titre: 'En préparation' },
  { statut: 'clos', titre: 'Fermés' },
]
const parStatut = computed(() => Object.fromEntries(SECTIONS.map((s) => [s.statut, (donnees.value?.butins ?? []).filter((b) => b.statut === s.statut)])))

const resume = (butin) => {
  const pieces = PIECES.filter((p) => butin.pieces[p.cle] > 0).map((p) => `${butin.pieces[p.cle]} ${p.cle}`)
  const objets = butin.objets.reduce((total, o) => total + o.quantite, 0)
  return [...pieces, objets ? `${objets} objet${objets > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'vide'
}

const creer = () => creation.envoyer(async () => {
  await api.creerButin(props.id, { titre: nouveauTitre.value, notesMj: '', pieces: Object.fromEntries(PIECES.map((p) => [p.cle, 0])) })
  nouveauTitre.value = ''
  await lire()
})
</script>

<template>
  <main class="page-butins">
    <header>
      <h1>Butins</h1>
      <p class="sous-titre">
        {{ donnees?.estMj
          ? 'Prépare le butin de chaque rencontre, puis ouvre-le : les joueurs sont prévenus et se servent, objets et pièces.'
          : 'Ce que la Compagnie a trouvé. Servez-vous : ce que tu prends va dans l’inventaire et la bourse de ta fiche.' }}
      </p>
    </header>
    <p v-if="chargement.erreur.value" class="message message--erreur" role="alert">{{ chargement.erreur.value }}</p>

    <template v-if="donnees?.estMj">
      <form class="nouveau" @submit.prevent="creer">
        <label class="champ">Nouveau butin <input v-model="nouveauTitre" maxlength="120" placeholder="Rencontre : Arc 2 — La chapelle" required></label>
        <button type="submit" class="bouton bouton--plein" :disabled="creation.enCours.value">Créer</button>
      </form>
      <p v-if="creation.erreur.value" class="message message--erreur" role="alert">{{ creation.erreur.value }}</p>
      <template v-for="s in SECTIONS" :key="s.statut">
        <section v-if="parStatut[s.statut].length" class="section">
          <h2>{{ s.titre }} ({{ parStatut[s.statut].length }})</h2>
          <template v-if="s.statut === 'ouvert'">
            <ButinMj v-for="b in parStatut[s.statut]" :key="b.id" :campagne-id="id" :butin="b" :objets-bibliotheque="objetsBibliotheque" @recharger="recharger" />
          </template>
          <!-- Les butins à venir ou finis restent repliés : la page reste lisible avec toute une campagne. -->
          <details v-for="b in parStatut[s.statut]" v-else :key="b.id" class="replie">
            <summary class="papier">{{ b.titre }} <small>{{ resume(b) }}</small></summary>
            <ButinMj :campagne-id="id" :butin="b" :objets-bibliotheque="objetsBibliotheque" @recharger="recharger" />
          </details>
        </section>
      </template>
      <p v-if="!donnees.butins.length" class="vide">Aucun butin pour l’instant.</p>
    </template>

    <template v-else-if="donnees">
      <p v-if="!aUneFiche" class="sans-fiche papier">
        Pour te servir, il te faut d’abord une fiche de personnage :
        <RouterLink :to="{ name: 'personnage', params: { id } }">créer ma fiche</RouterLink>.
      </p>
      <p v-if="!donnees.butins.length" class="vide">Aucun butin à partager pour l’instant.</p>
      <ButinJoueur v-for="b in donnees.butins" :key="b.id" :campagne-id="id" :butin="b" :peut-prendre="aUneFiche" @recharger="recharger" />
    </template>
  </main>
</template>

<style scoped>
.page-butins { max-width: 900px; margin: 0 auto; padding: 1.5rem max(16px, env(safe-area-inset-left)) 2rem; display: flex; flex-direction: column; gap: 1.2rem; }
h1 { font-size: clamp(2rem, 5vw, 2.8rem); color: var(--laiton-clair); text-shadow: 0 2px 2px rgba(0, 0, 0, 0.6); }
h2 { font-size: 1.4rem; color: #e8d6b0; }
.sous-titre { margin: 0.2rem 0 0; color: #cdb48c; font-style: italic; }
.nouveau { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-end; }
.nouveau .champ { color: #cdb48c; flex: 1 1 18rem; }
.section { display: flex; flex-direction: column; gap: 1rem; }
.replie summary { padding: 0.7rem 1rem; cursor: pointer; font-family: var(--f-titre); font-size: 1.15rem; list-style-position: inside; }
.replie summary small { font-family: var(--f-texte); font-size: var(--t-s); color: var(--encre-2); margin-left: 0.5rem; }
.replie[open] summary { margin-bottom: 0.5rem; }
.vide { color: #cdb48c; font-style: italic; margin: 0; }
.sans-fiche { margin: 0; padding: 0.8rem 1rem; }
.sans-fiche a { color: var(--ruban); }
.message--erreur { background: var(--papier); }
</style>
