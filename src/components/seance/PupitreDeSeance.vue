<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../../api/client.js'
import { formater } from '../../domain/calendrier.js'
import { changerPupitre, pupitreDe, sceneBornee } from '../../composables/pupitre.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import { moi } from '../../session.js'
import FormulaireAnnonce from '../notifications/FormulaireAnnonce.vue'

/**
 * Pupitre de séance du MJ, à côté de n'importe quelle page de la campagne :
 * les scènes préparées, révélées d'un geste, la date du monde, le butin de la scène et une note pour le Journal.
 */
const props = defineProps({ campagneId: { type: String, required: true } })

const NATURES = { pnj: 'Personnage', creature: 'Créature', lieu: 'Lieu', document: 'Document', objet: 'Objet' }

const scenes = ref([])
const joueurs = ref([])
const aujourdhui = ref(null)
const charge = ref(false)
const annonce = ref(false)
const aCertains = ref(false)
const choisis = ref([])
const note = ref('')
const fait = ref('')
const { enCours, erreur, envoyer } = utiliserEnvoi()

const pupitre = computed(() => pupitreDe(props.campagneId))
const position = computed(() => sceneBornee(pupitre.value.scene, scenes.value.length))
const scene = computed(() => scenes.value[position.value] ?? null)
const ensuite = computed(() => scenes.value.slice(position.value + 1))
const toutRevele = computed(() => scene.value?.elements.every((e) => e.etat === 'revele' || e.etat === 'vide'))

async function charger() {
  const [lues, calendrier] = await Promise.all([api.scenes(props.campagneId), api.calendrier(props.campagneId)])
  scenes.value = lues.scenes
  joueurs.value = lues.joueurs
  aujourdhui.value = calendrier.aujourdhui
  charge.value = true
}
onMounted(() => envoyer(charger))
watch(() => props.campagneId, () => envoyer(charger))

const allerA = (index) => {
  changerPupitre(props.campagneId, { scene: sceneBornee(index, scenes.value.length) })
  aCertains.value = false
  choisis.value = []
  fait.value = ''
}
const fermer = () => changerPupitre(props.campagneId, { ouvert: false })

/** Chaque geste recharge les scènes : l'état affiché est toujours celui du serveur. */
const agir = (action, message = '') => envoyer(async () => {
  fait.value = ''
  await action()
  await charger()
  fait.value = message
})

const basculer = (index, element) => agir(() => api.revelerScene(props.campagneId, scene.value.id,
  element.etat === 'revele' ? { element: index, masquer: true } : { element: index, pourTous: true, joueurs: [] }))
const revelerTout = () => agir(() => api.revelerScene(props.campagneId, scene.value.id, { pourTous: true, joueurs: [] }), 'Scène révélée au groupe.')
const revelerACertains = () => agir(async () => {
  await api.revelerScene(props.campagneId, scene.value.id, { pourTous: false, joueurs: choisis.value })
  aCertains.value = false
  choisis.value = []
}, 'Scène révélée aux joueurs choisis.')
const ouvrirButin = () => agir(() => api.changerStatutButin(props.campagneId, scene.value.butin.id, 'ouvert'), 'Butin ouvert : les joueurs sont prévenus.')
const avancerDUnJour = () => agir(() => api.changerDate(props.campagneId, aujourdhui.value + 1))
const noter = () => agir(async () => {
  await api.noterAuJournal(props.campagneId, note.value)
  note.value = ''
}, 'Note ajoutée au Journal.')

const libelleBouton = (etat) => ({ revele: 'Révélé', partiel: 'En partie', vide: 'Rien à révéler' }[etat] ?? 'Révéler')
const aideBouton = (element) => (element.etat === 'revele'
  ? `Cacher à nouveau ${element.nom}`
  : `Révéler ${element.nom} au groupe`)
</script>

<template>
  <aside class="pupitre" aria-labelledby="titre-pupitre">
    <div class="tete">
      <div>
        <p id="titre-pupitre" class="petites-capitales surtitre">Séance en cours</p>
        <p class="date">{{ aujourdhui === null ? '…' : formater(aujourdhui) }}</p>
      </div>
      <button type="button" class="rond" aria-label="Fermer le pupitre" @click="fermer">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
    <div class="outils">
      <button type="button" class="contour" :disabled="enCours || aujourdhui === null" @click="avancerDUnJour">+1 jour</button>
      <button type="button" class="contour" :aria-expanded="annonce" @click="annonce = !annonce">Annoncer…</button>
    </div>
    <FormulaireAnnonce v-if="annonce" :campagne-id="campagneId" :moi-id="moi.id" />

    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
    <p v-else class="statut" role="status">{{ fait }}</p>

    <section v-if="scene" class="scene papier" aria-live="polite">
      <div class="navigation">
        <button type="button" class="rond rond--papier" aria-label="Scène précédente" :disabled="position === 0" @click="allerA(position - 1)">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div class="titre-scene">
          <p class="compte">Scène {{ position + 1 }} sur {{ scenes.length }}<template v-if="scene.sousTitre"> · {{ scene.sousTitre }}</template></p>
          <h2>{{ scene.titre }}</h2>
        </div>
        <button type="button" class="rond rond--papier" aria-label="Scène suivante" :disabled="position === scenes.length - 1" @click="allerA(position + 1)">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      <p class="petites-capitales legende">À révéler dans cette scène</p>
      <ul class="elements">
        <li v-for="(element, i) in scene.elements" :key="`${element.ficheId}-${i}`">
          <div class="quoi">
            <p class="nature">{{ NATURES[element.type] }}</p>
            <p class="nom">{{ element.nom }}</p>
            <p class="detail">{{ element.quoi }}</p>
          </div>
          <button
            type="button" class="etat" :class="`etat--${element.etat}`" :disabled="enCours || element.etat === 'vide'"
            :title="aideBouton(element)" :aria-label="aideBouton(element)" @click="basculer(i, element)"
          >{{ libelleBouton(element.etat) }}</button>
        </li>
        <li v-if="!scene.elements.length" class="vide">Rien à révéler dans cette scène.</li>
      </ul>

      <p v-if="scene.suite" class="sorties"><strong>Sorties :</strong> {{ scene.suite }}</p>
      <button type="button" class="tout" :disabled="enCours || toutRevele" @click="revelerTout">
        {{ toutRevele ? 'Toute la scène est révélée' : 'Révéler toute la scène au groupe' }}
      </button>
      <button type="button" class="contour contour--papier" :aria-expanded="aCertains" @click="aCertains = !aCertains">À certains joueurs seulement…</button>
      <form v-if="aCertains" class="certains" @submit.prevent="revelerACertains">
        <fieldset>
          <legend>Révéler la scène à</legend>
          <label v-for="j in joueurs" :key="j.id"><input v-model="choisis" type="checkbox" :value="j.id"> {{ j.identifiant }}</label>
        </fieldset>
        <button type="submit" class="bouton bouton--plein" :disabled="enCours || !choisis.length">Révéler à {{ choisis.length || 'personne' }}</button>
      </form>
    </section>

    <section v-if="scene?.butin" class="bloc">
      <p class="petites-capitales surtitre">Butin de la scène · {{ scene.butin.titre }}</p>
      <p>{{ scene.butin.resume || 'Rien dedans pour l’instant.' }}</p>
      <button v-if="scene.butin.statut === 'prepare'" type="button" class="contour contour--laiton" :disabled="enCours" @click="ouvrirButin">Ouvrir le butin aux joueurs</button>
      <p v-else class="statut-butin">{{ scene.butin.statut === 'ouvert' ? 'Ouvert : les joueurs se servent.' : 'Clos.' }}</p>
    </section>

    <form class="note" @submit.prevent="noter">
      <label for="note-seance" class="petites-capitales surtitre">Note de séance (va au Journal)</label>
      <textarea id="note-seance" v-model="note" rows="3" maxlength="500" placeholder="Le rôdeur a gardé la Larme ronde." />
      <button type="submit" class="contour" :disabled="enCours || !note.trim()">Ajouter au Journal</button>
    </form>

    <section v-if="ensuite.length" class="ensuite">
      <p class="petites-capitales surtitre">Ensuite</p>
      <ul>
        <li v-for="(s, i) in ensuite" :key="s.id"><button type="button" class="lien" @click="allerA(position + 1 + i)">{{ s.titre }}</button></li>
      </ul>
    </section>

    <p v-if="charge && !scenes.length" class="aide">
      Aucune scène préparée. Elles s'importent sur le serveur avec <code>npm run cli -- importer-scenes &lt;n° campagne&gt; mj/&lt;fichier&gt;.json</code>.
    </p>
  </aside>
</template>

<style scoped>
.pupitre {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem 1.2rem 1.6rem;
  background: var(--cuir-2);
  border-left: 2px solid var(--laiton);
  color: #e8d6b0;
}
.tete { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
.surtitre { margin: 0; color: #cdb48c; }
.date { margin: 0.1rem 0 0; font-family: var(--f-titre); font-size: 1.6rem; color: var(--laiton-clair); }
.outils { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.statut { margin: 0; min-height: 1.2em; color: var(--laiton-clair); font-size: var(--t-s); }

button { font: inherit; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.55; }
.rond {
  width: 44px; height: 44px; flex: none; border-radius: 50%;
  display: inline-grid; place-items: center;
  border: 1px solid var(--couture); background: transparent; color: #e8d6b0;
}
.rond--papier { border-color: var(--papier-ombre); background: #f6ecd4; color: var(--encre); }
.contour {
  min-height: 44px; padding: 0 0.9rem; border-radius: 4px;
  border: 1px solid var(--couture); background: transparent; color: #e8d6b0; font-weight: 500;
}
.contour--papier { border-color: var(--papier-ombre); color: var(--encre); }
.contour--laiton { align-self: flex-start; border-color: var(--laiton-clair); color: var(--laiton-clair); font-weight: 700; }

.scene { padding: 1rem; border-radius: 4px; display: flex; flex-direction: column; gap: 0.75rem; }
.navigation { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.titre-scene { text-align: center; min-width: 0; }
.compte { margin: 0; font-size: var(--t-s); color: var(--encre-2); }
h2 { margin: 0; font-family: var(--f-titre); font-weight: 400; font-size: 1.5rem; }
.legende { margin: 0; color: var(--encre-2); }
.elements { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.elements li {
  display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;
  padding: 0.5rem 0.6rem; border: 1px dashed var(--papier-ombre); border-radius: 4px; background: #f6ecd4;
}
.elements .vide { justify-content: center; font-style: italic; color: var(--encre-2); }
.quoi { min-width: 0; }
.quoi p { margin: 0; }
.nature { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--encre-2); }
.nom { font-weight: 700; }
.detail { font-size: var(--t-s); color: var(--encre-2); }
.etat {
  flex: none; min-height: 44px; min-width: 6.5rem; padding: 0 0.75rem; border-radius: 22px;
  border: 1px solid var(--encre-2); background: transparent; color: var(--encre); font-weight: 700; font-size: var(--t-s);
}
.etat--revele { border-color: var(--vert); background: var(--vert); color: #f6ecd4; }
.etat--partiel { border-color: var(--ocre-alerte); color: var(--ocre-alerte); }
.sorties { margin: 0; font-size: var(--t-s); color: var(--encre-2); line-height: 1.5; }
.tout {
  min-height: 48px; border-radius: 4px; border: 0; background: var(--ruban); color: #f6ecd4; font-weight: 700; font-size: 1.05rem;
}
.certains { display: flex; flex-direction: column; gap: 0.5rem; }
.certains fieldset { margin: 0; padding: 0; border: 0; display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; }
.certains legend { font-size: var(--t-s); color: var(--encre-2); margin-bottom: 0.2rem; }
.certains label { min-height: 44px; display: inline-flex; align-items: center; gap: 0.35rem; }

.bloc { border: 1px dashed var(--couture); border-radius: 4px; padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.bloc p { margin: 0; line-height: 1.5; }
.statut-butin { color: #cdb48c; font-style: italic; }
.note { display: flex; flex-direction: column; gap: 0.4rem; }
.note textarea {
  border-radius: 4px; border: 1px solid var(--couture); background: var(--cuir); color: #e8d6b0;
  padding: 0.6rem; font: inherit; resize: vertical;
}
.note .contour { align-self: flex-start; }
.ensuite ul { list-style: none; margin: 0.3rem 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.2rem 0.4rem; }
.lien {
  min-height: 44px; padding: 0 0.3rem; border: 0; background: none; color: #cdb48c;
  text-decoration: underline; text-underline-offset: 3px;
}
.lien:hover { color: var(--laiton-clair); }
.aide { margin: 0; color: #cdb48c; line-height: 1.5; }
.aide code { font-family: var(--f-cote); font-size: var(--t-xs); color: #e8d6b0; }
</style>
