<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { api } from '../api/client.js'
import Portrait from '../components/bibliotheque/Portrait.vue'
import { FILTRES_REVELATION, garderSelon } from '../components/bibliotheque/revelation.js'
import { RUBRIQUES, rubriqueDe } from '../components/bibliotheque/rubriques.js'
import { utiliserEnvoi } from '../composables/envoi.js'
import { ATTITUDES, valeurLisible } from '../domain/fiches.js'

const props = defineProps({
  id: { type: String, required: true },
  type: { type: String, default: 'pnj' },
})

const textes = computed(() => rubriqueDe(props.type))
const router = useRouter()

const donnees = ref(null)
const recherche = ref('')
const attitude = ref('')
const ile = ref('')
const nouveauNom = ref('')
const filtreRevelation = ref('')
const selection = ref([])
const aCertains = ref(false)
const choisis = ref([])
const joueurs = ref([])
const fait = ref('')
const { enCours, erreur, envoyer } = utiliserEnvoi()

/** Chargement hors de `envoyer` : un changement d'onglet ne doit jamais être ignoré, ni afficher la mauvaise liste. */
async function charger() {
  const type = props.type
  try {
    const reponse = await api.bibliotheque(props.id, type)
    if (type === props.type) donnees.value = reponse
  } catch (e) {
    if (type === props.type) erreur.value = e.message
  }
}
onMounted(charger)
watch(() => props.type, () => {
  donnees.value = null; recherche.value = ''; attitude.value = ''; ile.value = ''; filtreRevelation.value = ''
  selection.value = []; aCertains.value = false; fait.value = ''
  charger()
})

const LIBELLES_REVELATION = { cache: 'Caché', partiel: 'En partie révélé', revele: 'Révélé' }

const ROLE_PAR_TYPE = { pnj: 'role', creature: 'nature', objet: 'nature' }

/** Pour un joueur, attitude et rôle ne sont connus que s'ils ont été révélés. Un lieu se résume à son île. */
function resume(fiche) {
  const base = donnees.value.estMj ? fiche : (() => {
    const valeur = (cle) => fiche.facettes.find((f) => f.cle === cle)?.valeur ?? ''
    return { ...fiche, role: valeur(ROLE_PAR_TYPE[props.type]), attitude: valeur('attitude') }
  })()
  return props.type === 'lieu' ? { ...base, role: base.nomIle ?? '' } : base
}

/** Les îles des lieux de la liste, pour filtrer. */
const iles = computed(() => {
  if (props.type !== 'lieu' || !donnees.value) return []
  const noms = new Map(donnees.value.fiches.filter((f) => f.ile).map((f) => [f.ile, f.nomIle]))
  return [...noms].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})

const fiches = computed(() => {
  if (!donnees.value) return []
  const texte = recherche.value.trim().toLocaleLowerCase('fr')
  const visibles = donnees.value.estMj ? garderSelon(donnees.value.fiches, filtreRevelation.value) : donnees.value.fiches
  return visibles.map(resume).filter((f) => (!attitude.value || f.attitude === attitude.value)
    && (!ile.value || f.ile === ile.value)
    && (!texte || `${f.nom ?? ''} ${f.role ?? ''}`.toLocaleLowerCase('fr').includes(texte)))
})

// --- Révélation par lots (MJ) : cocher des fiches, puis tout révéler d'un geste ---
const nombreChoisi = computed(() => selection.value.length)
const libelleSelection = computed(() => (nombreChoisi.value > 1 ? `${nombreChoisi.value} fiches sélectionnées` : '1 fiche sélectionnée'))
const toutSelectionner = () => { selection.value = fiches.value.map((f) => f.id) }
const deselectionner = () => { selection.value = []; aCertains.value = false; choisis.value = [] }

/** Les joueurs de la campagne, pour « À certains… » : le pupitre de séance les fournit déjà. */
async function chargerJoueurs() {
  if (joueurs.value.length) return
  joueurs.value = (await api.scenes(props.id)).joueurs
}
const ouvrirACertains = () => envoyer(async () => {
  await chargerJoueurs()
  aCertains.value = !aCertains.value
})

const revelerSelection = (revelation, message) => envoyer(async () => {
  fait.value = ''
  await api.revelerEnLot(props.id, selection.value, revelation)
  await charger()
  deselectionner()
  fait.value = message
})
const auGroupe = () => revelerSelection({ pourTous: true, joueurs: [] }, 'Révélé au groupe.')
const aCeuxChoisis = () => revelerSelection({ pourTous: false, joueurs: choisis.value }, 'Révélé aux joueurs choisis.')
const cacher = () => revelerSelection({ masquer: true }, 'Caché à nouveau.')

const creer = () => envoyer(async () => {
  const { ficheId } = await api.creerFiche(props.id, nouveauNom.value, props.type)
  await router.push({ name: textes.value.fiche, params: { id: props.id, ficheId } })
})
</script>

<template>
  <main class="bibliotheque">
    <nav class="rubans" aria-label="Rubriques de la bibliothèque">
      <RouterLink v-for="r in RUBRIQUES" :key="r.type" :to="{ name: r.liste, params: { id } }" class="ruban" :class="{ actif: r.type === type }" :aria-current="r.type === type ? 'page' : undefined">{{ r.onglet }}</RouterLink>
    </nav>
    <header class="entete">
      <h1>{{ textes.titre }}</h1>
      <p class="sous-titre">{{ donnees?.estMj ? textes.mj : textes.joueur }}</p>
    </header>

    <div class="outils">
      <label class="champ">Rechercher <input v-model="recherche" type="search" placeholder="Nom…"></label>
      <label v-if="type === 'pnj'" class="champ">Attitude
        <select v-model="attitude">
          <option value="">Toutes</option>
          <option v-for="a in ATTITUDES" :key="a.cle" :value="a.cle">{{ a.nom }}</option>
        </select>
      </label>
      <label v-if="iles.length > 1" class="champ">Île
        <select v-model="ile">
          <option value="">Toutes</option>
          <option v-for="i in iles" :key="i.id" :value="i.id">{{ i.nom }}</option>
        </select>
      </label>
      <form v-if="donnees?.estMj" class="nouveau" @submit.prevent="creer">
        <label class="champ">{{ textes.nouveau }} <input v-model="nouveauNom" type="text" maxlength="80" placeholder="Nom" required></label>
        <button type="submit" class="bouton bouton--plein" :disabled="enCours">Créer</button>
      </form>
    </div>

    <div v-if="donnees?.estMj" class="filtres" role="group" aria-label="Filtrer selon ce que les joueurs savent">
      <button v-for="f in FILTRES_REVELATION" :key="f.cle" type="button" class="puce" :aria-pressed="filtreRevelation === f.cle" @click="filtreRevelation = f.cle">{{ f.nom }}</button>
    </div>

    <div v-if="donnees?.estMj && nombreChoisi" class="selection" role="toolbar" aria-label="Actions sur la sélection">
      <strong>{{ libelleSelection }}</strong>
      <button type="button" class="action action--vert" :disabled="enCours" @click="auGroupe">Révéler au groupe</button>
      <button type="button" class="action" :disabled="enCours" :aria-expanded="aCertains" @click="ouvrirACertains">À certains…</button>
      <button type="button" class="action" :disabled="enCours" @click="cacher">Cacher</button>
      <button type="button" class="lien" @click="toutSelectionner">Tout sélectionner</button>
      <button type="button" class="lien" @click="deselectionner">Tout désélectionner</button>
      <form v-if="aCertains" class="certains" @submit.prevent="aCeuxChoisis">
        <fieldset>
          <legend>Révéler à</legend>
          <label v-for="j in joueurs" :key="j.id"><input v-model="choisis" type="checkbox" :value="j.id"> {{ j.identifiant }}</label>
        </fieldset>
        <button type="submit" class="action action--vert" :disabled="enCours || !choisis.length">Révéler</button>
      </form>
    </div>

    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
    <p v-else-if="fait" class="fait" role="status">{{ fait }}</p>
    <p v-if="donnees && !donnees.fiches.length" class="vide">{{ donnees.estMj ? textes.videMj : textes.videJoueur }}</p>

    <ul class="grille">
      <li v-for="f in fiches" :key="f.id" class="case" :class="{ 'case--mj': donnees.estMj, choisie: selection.includes(f.id) }">
        <input v-if="donnees.estMj" v-model="selection" type="checkbox" class="cocher" :value="f.id" :aria-label="`Sélectionner ${f.nom ?? textes.inconnu}`">
        <RouterLink :to="{ name: textes.fiche, params: { id, ficheId: f.id } }" class="carte papier">
          <Portrait :campagne-id="id" :image-id="f.portrait" :nom="f.nom ?? ''" :genre="type" />
          <div class="texte">
            <strong>{{ f.nom ?? textes.inconnu }}</strong>
            <span v-if="f.role" class="role">{{ f.role }}</span>
            <span class="marques">
              <span v-if="f.attitude" class="tampon" :class="`tampon--attitude-${f.attitude}`">{{ valeurLisible('attitude', f.attitude) }}</span>
              <span v-if="donnees.estMj" class="etat" :class="`etat--${f.revelation}`">{{ LIBELLES_REVELATION[f.revelation] }}</span>
              <span v-if="donnees.estMj && f.nombreNotes" class="etat">{{ f.nombreNotes }} note{{ f.nombreNotes > 1 ? 's' : '' }}</span>
            </span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.bibliotheque { max-width: 1100px; margin: 0 auto; padding: 1.5rem max(16px, env(safe-area-inset-left)) 2rem; display: flex; flex-direction: column; gap: 1.2rem; }
h1 { font-size: clamp(2rem, 5vw, 2.8rem); color: var(--laiton-clair); text-shadow: 0 2px 2px rgba(0, 0, 0, 0.6); }
.rubans { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.ruban { padding: 0.3rem 0.9rem; border: 1px solid var(--couture); border-radius: 3px 3px 0 0; color: #e8d6b0; text-decoration: none; background: rgba(0, 0, 0, 0.18); }
.ruban:hover { color: var(--laiton-clair); }
.ruban.actif { background: var(--ruban); border-color: var(--ruban); color: #f6ecd4; }
.sous-titre { margin: 0.2rem 0 0; color: #cdb48c; font-style: italic; }
.outils { display: flex; flex-wrap: wrap; gap: 0.8rem 1.2rem; align-items: flex-end; }
.outils .champ { color: #cdb48c; }
.nouveau { display: flex; gap: 0.5rem; align-items: flex-end; margin-left: auto; }
.vide { color: #cdb48c; font-style: italic; margin: 0; }
.grille { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr)); gap: 1rem; }
.case { position: relative; }
.case--mj .carte { padding-right: 2.6rem; }
.case.choisie .carte { outline: 3px solid var(--laiton); }
.cocher { position: absolute; top: 0.6rem; right: 0.6rem; z-index: 1; width: 24px; height: 24px; margin: 0; accent-color: var(--vert); }
.filtres { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.puce {
  min-height: 40px; padding: 0 0.9rem; border-radius: 20px; border: 1px solid var(--couture);
  background: transparent; color: #e8d6b0; font: inherit; cursor: pointer;
}
.puce[aria-pressed='true'] { background: var(--laiton-clair); border-color: var(--laiton-clair); color: var(--cuir); font-weight: 700; }
.selection {
  position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem;
  padding: 0.6rem 0.9rem; border-radius: 4px; background: var(--cuir-2); border: 1px solid var(--laiton);
}
.selection strong { color: var(--laiton-clair); }
.action {
  min-height: 44px; padding: 0 0.9rem; border-radius: 4px; border: 1px solid var(--couture);
  background: transparent; color: #e8d6b0; font: inherit; font-weight: 500; cursor: pointer;
}
.action--vert { border-color: var(--vert); background: var(--vert); color: #f6ecd4; font-weight: 700; }
.action:disabled { opacity: 0.5; cursor: not-allowed; }
.lien { min-height: 44px; padding: 0 0.3rem; border: 0; background: none; color: #cdb48c; font: inherit; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.certains { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.certains fieldset { margin: 0; padding: 0; border: 0; display: flex; flex-wrap: wrap; gap: 0.2rem 1rem; color: #e8d6b0; }
.certains legend { float: left; margin-right: 0.6rem; color: #cdb48c; }
.certains label { min-height: 44px; display: inline-flex; align-items: center; gap: 0.35rem; }
.fait { margin: 0; color: var(--laiton-clair); }
.carte { display: flex; gap: 0.9rem; padding: 0.9rem; text-decoration: none; color: var(--encre); height: 100%; transition: transform 0.15s ease; }
.carte:hover { transform: rotate(-0.4deg) translateY(-2px); }
.texte { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.texte strong { font-family: var(--f-titre); font-weight: 400; font-size: 1.25rem; line-height: 1.15; }
.role { color: var(--encre-2); font-size: var(--t-s); }
.marques { display: flex; flex-wrap: wrap; gap: 0.35rem 0.6rem; align-items: center; margin-top: auto; padding-top: 0.3rem; }
.etat { font-size: var(--t-xs); color: var(--encre-2); border: 1px dashed var(--papier-ombre); border-radius: 3px; padding: 0 0.35rem; }
.etat--cache { border-style: solid; }
.etat--revele { color: var(--vert); border-color: var(--vert); }
.etat--partiel { color: var(--ocre-alerte); border-color: var(--ocre-alerte); }
</style>
