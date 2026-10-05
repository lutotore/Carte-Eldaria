<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { api } from '../api/client.js'
import Portrait from '../components/bibliotheque/Portrait.vue'
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
watch(() => props.type, () => { donnees.value = null; recherche.value = ''; attitude.value = ''; ile.value = ''; charger() })

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
  return donnees.value.fiches.map(resume).filter((f) => (!attitude.value || f.attitude === attitude.value)
    && (!ile.value || f.ile === ile.value)
    && (!texte || `${f.nom ?? ''} ${f.role ?? ''}`.toLocaleLowerCase('fr').includes(texte)))
})

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

    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
    <p v-if="donnees && !donnees.fiches.length" class="vide">{{ donnees.estMj ? textes.videMj : textes.videJoueur }}</p>

    <ul class="grille">
      <li v-for="f in fiches" :key="f.id">
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
