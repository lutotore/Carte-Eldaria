<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../../api/client.js'
import { CARACTERISTIQUES } from '../../domain/personnage.js'
import { utiliserEnvoi } from '../../composables/envoi.js'

/**
 * Montée de niveau selon les règles : le serveur dit ce qui est proposé (il connaît aussi les livres privés),
 * le joueur choisit, le serveur vérifie et écrit. Une fiche libre peut d'abord se rattacher aux règles.
 */
const props = defineProps({
  campagneId: { type: String, required: true },
  personnage: { type: Object, required: true },
})
const emit = defineEmits(['recharger'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const etat = ref(null)
const ouvert = ref(false)
const confirmerAnnulation = ref(false)
const confirmerDetachement = ref(false)

// Rattachement : une ligne par classe, pour une fiche déjà multiclassée
const lignes = ref([])
// Montée : la classe où prendre le niveau
const classeMontee = ref(null)

// Montée
const sousClasse = ref('')
const modeAmelioration = ref('caracs')
const points = ref({})
const don = ref('')
const caracDuDon = ref('')
const choix = ref({})
const optionnelles = ref([])

const options = computed(() => etat.value?.options ?? null)
const rattachement = computed(() => etat.value?.rattachement ?? null)
const definition = (id) => rattachement.value?.classes.find((c) => c.id === id) ?? null
const demandeSousClasse = (ligne) => Boolean(definition(ligne.classe)) && ligne.niveau >= definition(ligne.classe).niveauSousClasse
const totalLignes = computed(() => lignes.value.reduce((t, l) => t + (Number(l.niveau) || 0), 0))
const ligneVide = (niveau) => ({ classe: '', niveau, sousClasse: '' })
const sousClasseRetenue = computed(() => options.value?.sousClasse?.find((s) => s.id === sousClasse.value) ?? null)
const donRetenu = computed(() => options.value?.amelioration?.dons.find((d) => d.id === don.value) ?? null)
/** Les aptitudes optionnelles cochées : leurs choix s'ajoutent, ceux qu'elles remplacent disparaissent. */
const optionnellesPrises = computed(() => (options.value?.optionnelles ?? []).filter((o) => optionnelles.value.includes(o.id)))
const aptitudesGagnees = computed(() => {
  const remplacees = optionnellesPrises.value.flatMap((o) => o.remplace.aptitudes)
  return (options.value?.aptitudes ?? []).filter((a) => !remplacees.some((r) => a === r || a.startsWith(`${r} `)))
})
const choixAFaire = computed(() => [
  ...(options.value?.choix ?? []).filter((c) => !optionnellesPrises.value.some((o) => o.remplace.listes.includes(c.cle))),
  ...optionnellesPrises.value.flatMap((o) => o.choix),
  ...(sousClasseRetenue.value?.choix ?? []),
  ...(modeAmelioration.value === 'don' ? donRetenu.value?.choix ?? [] : []),
])
/** « SRD 5.1 », ou « Livre du joueur, p. 80 ». */
const reference = ({ source, page }) => (page ? `${source}, p. ${page}` : source)
const totalPoints = computed(() => Object.values(points.value).reduce((t, n) => t + n, 0))
const nomCarac = (cle) => CARACTERISTIQUES.find((c) => c.cle === cle).nom

/** L'expertise peut aussi porter sur la compétence cochée au même niveau. */
function optionsDuChoix(c) {
  if (!c.avecLesNouvelles) return c.options
  const nouvelles = choixAFaire.value.find((x) => x.cle === 'competences')?.options.filter((o) => (choix.value.competences ?? []).includes(o.id)) ?? []
  return [...c.options, ...nouvelles]
}

function reinitialiser() {
  sousClasse.value = ''
  modeAmelioration.value = 'caracs'
  points.value = Object.fromEntries(CARACTERISTIQUES.map((c) => [c.cle, 0]))
  don.value = ''
  caracDuDon.value = ''
  choix.value = {}
  optionnelles.value = []
  confirmerAnnulation.value = false
  confirmerDetachement.value = false
}

const charger = () => envoyer(async () => {
  etat.value = await api.reglesPersonnage(props.campagneId, props.personnage.id, classeMontee.value)
  classeMontee.value = etat.value.options?.classe?.id ?? classeMontee.value
  if (etat.value.rattachement && lignes.value.length === 0) lignes.value = [ligneVide(etat.value.rattachement.niveau)]
  reinitialiser()
})
onMounted(charger)
watch(() => props.personnage, () => {
  classeMontee.value = null
  lignes.value = []
  return charger()
})
const changerClasse = () => charger()

/** Une case de plus que le nombre permis ne se coche pas. */
function basculer(cle, id, nombre) {
  const pris = choix.value[cle] ?? []
  if (pris.includes(id)) choix.value = { ...choix.value, [cle]: pris.filter((x) => x !== id) }
  else if (pris.length < nombre) choix.value = { ...choix.value, [cle]: [...pris, id] }
  // Une compétence décochée ne peut plus porter l'expertise.
  const expertise = choixAFaire.value.find((c) => c.cle === 'expertise')
  if (cle === 'competences' && expertise && choix.value.expertise) {
    const permis = optionsDuChoix(expertise).map((o) => o.id)
    choix.value = { ...choix.value, expertise: choix.value.expertise.filter((x) => permis.includes(x)) }
  }
}

function demande() {
  const resultat = { classe: options.value.classe.id }
  if (optionnelles.value.length) resultat.optionnelles = [...optionnelles.value]
  if (options.value.sousClasse) resultat.sousClasse = sousClasse.value || null
  if (options.value.amelioration) {
    if (modeAmelioration.value === 'don') {
      resultat.amelioration = { don: don.value || null }
      if (donRetenu.value?.amelioration && caracDuDon.value) resultat.amelioration.caracs = { [caracDuDon.value]: donRetenu.value.amelioration.valeur }
    } else {
      resultat.amelioration = { caracs: Object.fromEntries(Object.entries(points.value).filter(([, n]) => n > 0)) }
    }
  }
  const pris = Object.fromEntries(choixAFaire.value.map((c) => [c.cle, choix.value[c.cle] ?? []]))
  if (Object.keys(pris).length) resultat.choix = pris
  return resultat
}

const apres = (action) => envoyer(async () => {
  await action()
  ouvert.value = false
  emit('recharger')
})

const rattacher = () => apres(() => api.rattacherAuxRegles(props.campagneId, props.personnage.id, {
  classes: lignes.value.map((l) => ({ classe: l.classe, niveau: Number(l.niveau), sousClasse: demandeSousClasse(l) ? l.sousClasse || null : null })),
}))
const monter = () => apres(() => api.monterDeNiveau(props.campagneId, props.personnage.id, demande()))
const annuler = () => apres(() => api.annulerMontee(props.campagneId, props.personnage.id))
const detacher = () => apres(() => api.detacherDesRegles(props.campagneId, props.personnage.id))
</script>

<template>
  <p v-if="!etat && erreur" class="message message--erreur" role="alert">Montée de niveau indisponible : {{ erreur }}</p>
  <section v-if="etat" class="montee papier" :class="{ compacte: !ouvert && !rattachement }" aria-labelledby="titre-montee">
    <!-- Fiche libre : on la rattache aux règles -->
    <template v-if="rattachement">
      <h2 id="titre-montee">Suivre les règles du site</h2>
      <p class="chapeau">
        Indique la classe de ton personnage (niveau {{ rattachement.niveau }}) : tu pourras ensuite monter de niveau ici,
        avec les aptitudes, les choix et les PV calculés pour toi. Tes PV actuels ne changent pas.
      </p>
      <form class="rattachement" @submit.prevent="rattacher">
        <div v-for="(l, i) in lignes" :key="i" class="ligne">
          <label class="champ">Classe
            <select v-model="l.classe" required @change="l.sousClasse = ''">
              <option value="" disabled>Choisir…</option>
              <option v-for="c in rattachement.classes" :key="c.id" :value="c.id" :disabled="lignes.some((x) => x !== l && x.classe === c.id)">{{ c.nom }}</option>
            </select>
          </label>
          <label v-if="lignes.length > 1" class="champ court">Niveau <input v-model.number="l.niveau" type="number" min="1" max="20" required></label>
          <label v-if="demandeSousClasse(l)" class="champ">Sous-classe
            <select v-model="l.sousClasse" required>
              <option value="" disabled>Choisir…</option>
              <option v-for="s in definition(l.classe).sousClasses" :key="s.id" :value="s.id">{{ s.nom }}</option>
            </select>
          </label>
          <button v-if="lignes.length > 1" type="button" class="lien-bouton" @click="lignes.splice(i, 1)">Retirer</button>
        </div>
        <p v-if="lignes.length > 1" class="aide" :class="{ 'aide--ok': totalLignes === rattachement.niveau }">
          {{ totalLignes }} / {{ rattachement.niveau }} niveaux répartis
        </p>
        <div class="ligne">
          <button type="submit" class="bouton bouton--plein" :disabled="enCours || lignes.some((l) => !l.classe)">Suivre les règles</button>
          <button v-if="rattachement.niveau > lignes.length" type="button" class="lien-bouton" @click="lignes.push(ligneVide(1))">Déjà multiclassé ? Ajouter une classe</button>
        </div>
      </form>
    </template>

    <!-- Fiche qui suit les règles -->
    <template v-else>
      <header class="entete">
        <h2 id="titre-montee">Montée de niveau</h2>
        <button v-if="etat.classes.some((c) => c.disponible) && etat.options.niveauTotal !== undefined && !ouvert" type="button" class="bouton bouton--plein" @click="ouvert = true">
          Passer au niveau {{ options.niveauTotal }}
        </button>
      </header>
      <p v-if="!options.possible && !ouvert" class="chapeau">{{ options.raison }}</p>

      <form v-if="ouvert" class="assistant" @submit.prevent="monter">
        <label class="champ">Prendre le niveau en
          <select v-model="classeMontee" @change="changerClasse">
            <option v-for="c in etat.classes" :key="c.id" :value="c.id" :disabled="!c.disponible">
              {{ c.nom }}{{ c.niveau ? ` (niveau ${c.niveau})` : c.disponible ? ' — multiclassage' : ` — ${c.raison}` }}
            </option>
          </select>
        </label>
        <p v-if="!options.possible" class="chapeau">{{ options.raison }}</p>
        <template v-else>
          <p class="resume">
            <strong>{{ options.classe.nom }} {{ options.niveauClasse }}</strong> —
            +{{ options.pv.gain }} PV (moyenne du d{{ options.pv.de }} et Constitution)
          </p>
          <div v-if="aptitudesGagnees.length" class="bloc">
            <h3>Ce que tu gagnes</h3>
            <ul><li v-for="a in aptitudesGagnees" :key="a">{{ a }}</li></ul>
          </div>

          <fieldset v-if="options.optionnelles.length" class="bloc">
          <legend>Aptitudes optionnelles de classe</legend>
          <label v-for="o in options.optionnelles" :key="o.id" class="option">
            <input v-model="optionnelles" type="checkbox" :value="o.id">
            <span><strong>{{ o.nom }}</strong> <small>({{ reference(o) }})</small>
              <span class="details">{{ o.resume }}<template v-if="o.remplace.aptitudes.length"> Remplace : {{ o.remplace.aptitudes.join(', ') }}.</template></span>
            </span>
          </label>
        </fieldset>

        <fieldset v-if="options.sousClasse" class="bloc">
            <legend>Sous-classe</legend>
            <label v-for="s in options.sousClasse" :key="s.id" class="option">
              <input v-model="sousClasse" type="radio" name="sous-classe" :value="s.id" required @change="choix = {}">
              <span><strong>{{ s.nom }}</strong> <small>({{ reference(s) }})</small>
                <span v-if="s.aptitudes.length" class="details">{{ s.aptitudes.join(', ') }}</span>
              <span v-if="s.sorts?.length" class="details">Sorts : {{ s.sorts.join(', ') }} (à choisir ensuite dans le panneau Sorts)</span></span>
            </label>
          </fieldset>

          <fieldset v-if="options.amelioration" class="bloc">
            <legend>Amélioration de caractéristiques ou don</legend>
            <div class="ligne">
              <label><input v-model="modeAmelioration" type="radio" value="caracs"> +2 points de caractéristique</label>
              <label><input v-model="modeAmelioration" type="radio" value="don"> Un don</label>
            </div>
            <div v-if="modeAmelioration === 'caracs'" class="caracs">
              <label v-for="c in CARACTERISTIQUES" :key="c.cle" class="champ court">{{ c.nom }} ({{ options.amelioration.caracs[c.cle] }})
                <select v-model.number="points[c.cle]">
                  <option :value="0">—</option>
                  <option :value="1" :disabled="options.amelioration.caracs[c.cle] >= 20">+1</option>
                  <option :value="2" :disabled="options.amelioration.caracs[c.cle] >= 19">+2</option>
                </select>
              </label>
              <p class="aide" :class="{ 'aide--ok': totalPoints === 2 }">{{ totalPoints }} / 2 points répartis</p>
            </div>
            <div v-else class="dons">
              <label class="champ">Don
                <select v-model="don" required @change="caracDuDon = ''">
                  <option value="" disabled>Choisir…</option>
                  <option v-for="d in options.amelioration.dons" :key="d.id" :value="d.id" :disabled="!d.disponible">
                    {{ d.nom }}{{ d.disponible ? '' : ` — ${d.raison}` }}
                  </option>
                </select>
              </label>
              <p v-if="donRetenu" class="details">{{ donRetenu.resume }} <small>({{ reference(donRetenu) }})</small></p>
            <p v-if="donRetenu?.aVerifier" class="aide">À vérifier toi-même : {{ donRetenu.aVerifier }}.</p>
              <label v-if="donRetenu?.amelioration" class="champ">Caractéristique (+{{ donRetenu.amelioration.valeur }})
                <select v-model="caracDuDon" required>
                  <option value="" disabled>Choisir…</option>
                  <option v-for="cle in donRetenu.amelioration.parmi" :key="cle" :value="cle">{{ nomCarac(cle) }}</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset v-for="c in choixAFaire" :key="c.cle" class="bloc">
            <legend>{{ c.libelle }} — {{ c.nombre }} au choix ({{ (choix[c.cle] ?? []).length }}/{{ c.nombre }})</legend>
            <div class="options">
              <label v-for="o in optionsDuChoix(c)" :key="o.id" class="option">
                <input type="checkbox" :checked="(choix[c.cle] ?? []).includes(o.id)"
                  :disabled="!(choix[c.cle] ?? []).includes(o.id) && (choix[c.cle] ?? []).length >= c.nombre"
                  @change="basculer(c.cle, o.id, c.nombre)">
                {{ o.nom }}
              </label>
            </div>
          </fieldset>

          <ul v-if="options.aVenir.length" class="a-venir"><li v-for="n in options.aVenir" :key="n">{{ n }}</li></ul>
        </template>

        <div class="ligne">
          <button type="submit" class="bouton bouton--plein" :disabled="enCours || !options.possible">Monter au niveau {{ options.niveauTotal }}</button>
          <button type="button" class="lien-bouton" @click="ouvert = false; reinitialiser()">Fermer</button>
        </div>
      </form>

      <footer class="pied">
        <template v-if="etat.annulable">
          <button v-if="!confirmerAnnulation" type="button" class="lien-bouton" @click="confirmerAnnulation = true">
            Annuler la montée au niveau {{ etat.annulable.niveau }}…
          </button>
          <span v-else class="confirmer">
            Revenir au niveau {{ etat.annulable.niveau - 1 }}, avec les choix d’avant ?
            <button type="button" class="bouton" :disabled="enCours" @click="annuler">Oui, annuler</button>
            <button type="button" class="lien-bouton" @click="confirmerAnnulation = false">Non</button>
          </span>
        </template>
        <button v-if="!confirmerDetachement" type="button" class="lien-bouton discret" @click="confirmerDetachement = true">Ne plus suivre les règles…</button>
        <span v-else class="confirmer">
          La fiche redevient libre ; l’historique des montées est oublié.
          <button type="button" class="bouton bouton--rouge" :disabled="enCours" @click="detacher">Oui</button>
          <button type="button" class="lien-bouton" @click="confirmerDetachement = false">Non</button>
        </span>
      </footer>
    </template>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
  </section>
</template>

<style scoped>
.montee { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; }
.montee h2 { margin: 0; }
.chapeau { margin: 0; }
.entete { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.rattachement { display: flex; flex-direction: column; gap: 0.6rem; }
.ligne { display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: end; }
.assistant { display: flex; flex-direction: column; gap: 0.9rem; }
.resume { margin: 0; font-size: 1.05rem; }
.bloc { border: 1px solid rgba(90, 60, 30, 0.35); border-radius: 4px; padding: 0.6rem 0.8rem; margin: 0; }
.bloc h3 { margin: 0 0 0.3rem; font-size: 1rem; }
.bloc ul { margin: 0; padding-left: 1.2rem; }
.bloc legend { font-weight: bold; padding: 0 0.3rem; }
.option { display: flex; gap: 0.5rem; align-items: baseline; padding: 0.15rem 0; }
.options { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.1rem 1rem; }
.details { display: block; font-size: 0.92rem; color: #5b4632; }
.caracs { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: end; margin-top: 0.5rem; }
.dons { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
.aide { margin: 0; font-style: italic; color: #8a3b2c; }
.aide--ok { color: #3f6b35; }
.a-venir { margin: 0; padding-left: 1.2rem; font-style: italic; font-size: 0.92rem; }
.pied { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.8rem; font-size: 0.92rem; }
.discret { color: #7a6450; }
.confirmer { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.compacte { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 0.45rem 0.9rem; gap: 0.4rem 1rem; }
.compacte .entete { gap: 0.8rem; }
.compacte h2 { font-size: 1.05rem; }
.compacte .chapeau { font-size: var(--t-s); }
.compacte .pied { gap: 1rem; font-size: var(--t-s); }
</style>
