<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../api/client.js'
import FormulaireEntree from '../components/calendrier/FormulaireEntree.vue'
import SelecteurDate from '../components/calendrier/SelecteurDate.vue'
import { TYPES_ENTREE } from '../components/calendrier/types.js'
import { utiliserEnvoi } from '../composables/envoi.js'
import {
  depuisDate, formater, grilleDuMois, moisVoisin, nomDuMois, parJour, prochains, souffleDe, versDate,
} from '../domain/calendrier.js'

const props = defineProps({ id: { type: String, required: true } })

const donnees = ref(null)
const page = ref(null) // { annee, mois } affichés
const choisi = ref(null) // jour sélectionné dans la grille
const formulaire = ref(null) // { entree } : null = fermé, entree null = création
const fait = ref('')
const avance = ref(1)
const nouvelleDate = ref(0)
const butoir = ref(null)
const chargement = utiliserEnvoi()
const { enCours, erreur, envoyer } = utiliserEnvoi()

/** Le formulaire de la date butoir tel que le serveur le connaît ; une saisie en cours n'est pas écrasée par un rechargement. */
const butoirDuServeur = (reponse) => ({
  jour: reponse.butoir?.jour ?? reponse.aujourdhui + 365, libelle: reponse.butoir?.libelle ?? 'La catastrophe', revele: reponse.butoir?.revele ?? false, active: reponse.butoir !== null,
})
let butoirRecu = null

async function lire() {
  const reponse = await api.calendrier(props.id)
  const dateAvant = donnees.value?.aujourdhui
  donnees.value = reponse
  if (nouvelleDate.value === dateAvant || dateAvant === undefined) nouvelleDate.value = reponse.aujourdhui
  if (!reponse.estMj) butoir.value = null
  else {
    const recu = butoirDuServeur(reponse)
    if (!butoir.value || JSON.stringify(butoir.value) === JSON.stringify(butoirRecu)) butoir.value = recu
    butoirRecu = recu
  }
  if (!page.value) {
    const { annee, mois } = versDate(reponse.aujourdhui)
    page.value = { annee, mois }
    choisi.value = reponse.aujourdhui
  }
}
const charger = () => chargement.envoyer(lire)
onMounted(charger)
watch(() => props.id, () => {
  donnees.value = null
  page.value = null
  formulaire.value = null
  butoir.value = null
  fait.value = ''
  erreur.value = ''
  charger()
})

const agir = (action, message) => envoyer(async () => {
  fait.value = ''
  await action()
  await lire()
  fait.value = message
})

// --- La page du mois ---
const grille = computed(() => (page.value ? grilleDuMois(page.value.annee, page.value.mois) : []))
const bornes = computed(() => {
  const jours = grille.value.flat()
  return jours.length ? { debut: jours[0].jour, fin: jours.at(-1).jour } : null
})
const index = computed(() => (donnees.value && bornes.value ? parJour(donnees.value.evenements, bornes.value.debut, bornes.value.fin) : new Map()))
const titrePage = computed(() => page.value && `${nomDuMois(page.value.mois)} ${page.value.annee}`)
const souffle = computed(() => bornes.value && souffleDe(bornes.value.debut))
/** Changer de page choisit son premier jour : le panneau du jour reste celui de la page affichée. */
function changerPage(sens) {
  page.value = moisVoisin(page.value, sens)
  choisi.value = depuisDate({ ...page.value, jour: 1 })
}
function allerA(jour) {
  const { annee, mois } = versDate(jour)
  page.value = { annee, mois }
  choisi.value = jour
}

/** Les entrées du mois affiché, une fois chacune, dans l'ordre. */
const entreesDuMois = computed(() => {
  const vues = new Map()
  for (const entrees of index.value.values()) for (const e of entrees) if (!vues.has(`${e.id}-${e.occurrence}`)) vues.set(`${e.id}-${e.occurrence}`, e)
  return [...vues.values()].sort((a, b) => a.occurrence - b.occurrence || a.id - b.id)
})
const entreesDuJour = computed(() => (choisi.value === null ? [] : index.value.get(choisi.value) ?? []))
const aVenir = computed(() => (donnees.value ? prochains(donnees.value.evenements.filter((e) => e.type !== 'chronique'), donnees.value.aujourdhui, 6) : []))
const chronique = computed(() => (donnees.value ? donnees.value.evenements.filter((e) => e.type === 'chronique').sort((a, b) => b.jour - a.jour) : []))

const modifiable = (e) => (e.type === 'note' ? e.mienne : donnees.value.estMj)
const ouvrirCreation = () => { formulaire.value = { entree: null } }
const ouvrirEdition = (e) => { formulaire.value = { entree: e } }
const apresEnregistrement = (message) => agir(async () => { formulaire.value = null }, message)
const supprimer = (e) => agir(() => api.supprimerEvenement(props.id, e.id), 'Entrée supprimée.')

// --- Le temps qui passe (MJ) ---
const avancer = (jours) => agir(() => api.changerDate(props.id, donnees.value.aujourdhui + jours), 'Date du monde mise à jour.')
const fixerDate = () => agir(() => api.changerDate(props.id, nouvelleDate.value), 'Date du monde mise à jour.')
const enregistrerButoir = () => agir(() => api.changerButoir(props.id, {
  jour: butoir.value.active ? butoir.value.jour : null, libelle: butoir.value.libelle, revele: butoir.value.revele,
}), butoir.value.revele && butoir.value.active ? 'Date butoir enregistrée et visible des joueurs.' : 'Date butoir enregistrée.')

const compteARebours = (n) => (n > 0 ? `J-${n}` : n === 0 ? 'Aujourd’hui' : `Dépassée de ${-n} jour${n < -1 ? 's' : ''}`)
const etiquetteDuJour = (j) => formater(j, { avecAnnee: false })
</script>

<template>
  <main class="page-calendrier">
    <p v-if="chargement.erreur.value" class="message message--erreur" role="alert">{{ chargement.erreur.value }}</p>

    <template v-if="donnees">
      <header class="entete">
        <p class="petites-capitales">Nous sommes le</p>
        <h1>{{ formater(donnees.aujourdhui) }}</h1>
        <p class="souffle">{{ souffleDe(donnees.aujourdhui).nom }} — {{ souffleDe(donnees.aujourdhui).description }}</p>
      </header>

      <section v-if="donnees.estMj" class="temps papier" aria-labelledby="titre-temps">
        <h2 id="titre-temps">Le temps qui passe</h2>
        <div class="ligne">
          <button type="button" class="bouton" :disabled="enCours" @click="avancer(1)">+1 jour</button>
          <label class="champ court">Jours <input v-model.number="avance" type="number" min="1"></label>
          <button type="button" class="bouton" :disabled="enCours || !(avance >= 1)" @click="avancer(avance)">Avancer de {{ avance }} jour{{ avance > 1 ? 's' : '' }}</button>
        </div>
        <div class="ligne">
          <SelecteurDate v-model="nouvelleDate" legende="Ou fixer la date" />
          <button type="button" class="bouton" :disabled="enCours || nouvelleDate === donnees.aujourdhui" @click="fixerDate">Fixer</button>
        </div>
      </section>

      <section v-if="donnees.estMj && butoir" class="butoir papier" :class="{ revele: butoir.revele }" aria-labelledby="titre-butoir">
        <h2 id="titre-butoir">Date butoir</h2>
        <p v-if="donnees.butoir" class="decompte">
          <strong>{{ compteARebours(donnees.butoir.joursRestants) }}</strong>
          {{ donnees.butoir.libelle }}, le {{ formater(donnees.butoir.jour) }}
          <span class="etat">{{ donnees.butoir.revele ? 'visible des joueurs' : 'secret' }}</span>
        </p>
        <form class="ligne" @submit.prevent="enregistrerButoir">
          <label class="coche"><input v-model="butoir.active" type="checkbox"> Une date butoir</label>
          <template v-if="butoir.active">
            <label class="champ">Nom <input v-model="butoir.libelle" maxlength="120" required></label>
            <SelecteurDate v-model="butoir.jour" legende="Date" />
            <label class="coche"><input v-model="butoir.revele" type="checkbox"> Révélée aux joueurs</label>
          </template>
          <button type="submit" class="bouton bouton--plein" :disabled="enCours">Enregistrer</button>
        </form>
      </section>
      <section v-else-if="donnees.butoir" class="butoir papier revele">
        <p class="decompte"><strong>{{ compteARebours(donnees.butoir.joursRestants) }}</strong> {{ donnees.butoir.libelle }}, le {{ formater(donnees.butoir.jour) }}</p>
      </section>

      <p class="statut" aria-live="polite">
        <span v-if="erreur" class="message message--erreur">{{ erreur }}</span>
        <span v-else-if="fait" class="message message--ok">{{ fait }}</span>
      </p>

      <div class="corps">
        <section class="mois papier epingle" aria-labelledby="titre-mois">
          <header class="navigation">
            <button type="button" class="fleche" aria-label="Mois précédent" @click="changerPage(-1)">‹</button>
            <div>
              <h2 id="titre-mois">{{ titrePage }}</h2>
              <p class="souffle-mois">{{ souffle?.nom }}</p>
            </div>
            <button type="button" class="fleche" aria-label="Mois suivant" @click="changerPage(1)">›</button>
          </header>
          <button type="button" class="lien-bouton revenir" @click="allerA(donnees.aujourdhui)">Revenir à aujourd’hui</button>

          <div class="grille" role="grid" :aria-label="titrePage">
            <div v-for="(decade, d) in grille" :key="d" class="decade" role="row">
              <button
                v-for="j in decade" :key="j.jour" type="button" role="gridcell" class="jour"
                :class="{ aujourdhui: j.jour === donnees.aujourdhui, choisi: j.jour === choisi, passe: j.jour < donnees.aujourdhui, butoir: donnees.butoir?.jour === j.jour }"
                :aria-label="`${formater(j.jour)}${index.get(j.jour)?.length ? `, ${index.get(j.jour).length} entrée(s)` : ''}`"
                :aria-pressed="j.jour === choisi"
                @click="choisi = j.jour"
              >
                <span class="numero">{{ j.numero }}</span>
                <span class="pastilles">
                  <i v-for="e in (index.get(j.jour) ?? []).slice(0, 4)" :key="`${e.id}-${e.occurrence}`" class="pastille" :class="[`pastille--${e.type}`, { cache: e.visibilite === 'cache' }]" />
                </span>
              </button>
            </div>
          </div>
          <p class="legende">
            <span v-for="(t, cle) in TYPES_ENTREE" :key="cle"><i class="pastille" :class="`pastille--${cle}`" /> {{ t.nom }}</span>
          </p>

          <div class="jour-choisi">
            <h3>{{ choisi !== null ? formater(choisi) : '' }}</h3>
            <p v-if="!entreesDuJour.length" class="vide">Rien ce jour-là.</p>
            <article v-for="e in entreesDuJour" :key="`${e.id}-${e.occurrence}`" class="entree" :class="[`entree--${e.type}`, { cache: e.visibilite === 'cache' }]">
              <p class="type">{{ TYPES_ENTREE[e.type].nom }}<template v-if="e.visibilite === 'cache'"> · caché</template><template v-if="e.visibilite === 'privee'"> · privée</template><template v-if="e.auteur"> · {{ e.auteur }}</template></p>
              <h4>{{ e.titre }}</h4>
              <p class="quand">{{ e.duree > 1 ? `Du ${etiquetteDuJour(e.occurrence)} au ${formater(e.occurrence + e.duree - 1)}` : formater(e.occurrence) }}<template v-if="e.annuel"> · chaque année</template></p>
              <p v-if="e.description" class="description">{{ e.description }}</p>
              <div v-if="modifiable(e)" class="actions">
                <button type="button" class="lien-bouton" @click="ouvrirEdition(e)">Modifier</button>
                <button type="button" class="lien-bouton supprimer" :disabled="enCours" @click="supprimer(e)">Supprimer</button>
              </div>
            </article>
            <button v-if="!formulaire" type="button" class="bouton" @click="ouvrirCreation">{{ donnees.estMj ? 'Ajouter une entrée' : 'Ajouter une note' }}</button>
          </div>

          <FormulaireEntree
            v-if="formulaire" :key="formulaire.entree?.id ?? 'nouvelle'" :campagne-id="id" :est-mj="donnees.estMj" :entree="formulaire.entree"
            :jour-initial="choisi ?? donnees.aujourdhui" @enregistre="apresEnregistrement" @annuler="formulaire = null"
          />
        </section>

        <aside class="cote">
          <section class="papier bloc">
            <h2>À venir</h2>
            <p v-if="!aVenir.length" class="vide">Rien d’annoncé.</p>
            <ul class="liste">
              <li v-for="e in aVenir" :key="`${e.id}-${e.occurrence}`">
                <button type="button" class="lien-entree" @click="allerA(e.occurrence)">
                  <i class="pastille" :class="`pastille--${e.type}`" />
                  <span><strong>{{ e.titre }}</strong><small>{{ formater(e.occurrence) }} · {{ compteARebours(e.occurrence - donnees.aujourdhui) }}</small></span>
                </button>
              </li>
            </ul>
          </section>

          <section class="papier bloc">
            <h2>Ce mois-ci</h2>
            <p v-if="!entreesDuMois.length" class="vide">Rien ce mois-ci.</p>
            <ul class="liste">
              <li v-for="e in entreesDuMois" :key="`${e.id}-${e.occurrence}`">
                <button type="button" class="lien-entree" @click="choisi = Math.max(e.occurrence, bornes.debut)">
                  <i class="pastille" :class="`pastille--${e.type}`" />
                  <span><strong>{{ e.titre }}</strong><small>{{ formater(e.occurrence, { avecAnnee: false }) }}</small></span>
                </button>
              </li>
            </ul>
          </section>

          <section class="papier bloc">
            <h2>Chronique</h2>
            <p v-if="!chronique.length" class="vide">{{ donnees.estMj ? 'Ajoute une « chronique de séance » pour dater chaque séance dans le monde.' : 'Aucune séance consignée pour l’instant.' }}</p>
            <ol class="liste chronique">
              <li v-for="e in chronique" :key="e.id">
                <button type="button" class="lien-entree" @click="allerA(e.jour)">
                  <span><strong>{{ e.titre }}</strong><small>{{ e.duree > 1 ? `${etiquetteDuJour(e.jour)} → ${formater(e.jour + e.duree - 1)}` : formater(e.jour) }}</small></span>
                </button>
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </template>
    <p v-else-if="!chargement.erreur.value" class="attente">Ouverture du calendrier…</p>
  </main>
</template>

<style scoped>
.page-calendrier { max-width: 1150px; margin: 0 auto; padding: 1.5rem max(16px, env(safe-area-inset-left)) 2rem; display: flex; flex-direction: column; gap: 1rem; }
.entete .petites-capitales { margin: 0; color: #cdb48c; }
h1 { font-size: clamp(2rem, 5vw, 2.9rem); color: var(--laiton-clair); text-shadow: 0 2px 2px rgba(0, 0, 0, 0.6); line-height: 1.1; }
.souffle { margin: 0.2rem 0 0; color: #cdb48c; font-style: italic; }
h2 { font-size: 1.3rem; }
.temps, .butoir { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.6rem; }
.ligne { display: flex; flex-wrap: wrap; gap: 0.6rem 1rem; align-items: flex-end; }
.court input { width: 5rem; }
.coche { display: flex; gap: 0.35rem; align-items: center; font-size: var(--t-s); padding-bottom: 0.4rem; }
.butoir { border-left: 5px solid var(--rouge); }
.butoir.revele { border-left-color: var(--ruban); }
.decompte { margin: 0; display: flex; flex-wrap: wrap; gap: 0.3rem 0.7rem; align-items: baseline; }
.decompte strong { font-family: var(--f-cote); font-size: 1.4rem; color: var(--rouge); }
.etat { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.1em; color: var(--encre-2); }
.statut { margin: 0; min-height: 1.4rem; }
.corps { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr); gap: 1.2rem; align-items: start; }
@media (max-width: 860px) { .corps { grid-template-columns: minmax(0, 1fr); } }
.mois { padding: 1.6rem 1.2rem 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; }
.navigation { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; text-align: center; }
.navigation h2 { font-size: 1.7rem; }
.souffle-mois { margin: 0; font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
.fleche { background: none; border: 1px solid var(--papier-ombre); border-radius: 50%; width: 2.4rem; height: 2.4rem; font-size: 1.4rem; color: var(--encre); }
.fleche:hover { background: rgba(0, 0, 0, 0.05); }
.revenir { align-self: center; font-size: var(--t-s); }
.grille { display: flex; flex-direction: column; gap: 0.3rem; }
.decade { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 0.3rem; }
.jour { font: inherit; cursor: pointer; aspect-ratio: 1 / 1.1; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 0.2rem 0.1rem; border: 1px solid var(--papier-ombre); border-radius: 3px; background: rgba(246, 236, 212, 0.55); color: var(--encre); min-width: 0; }
.jour:hover { background: #f6ecd4; }
.jour.passe { opacity: 0.6; }
.jour.aujourdhui { border: 2px solid var(--rouge); opacity: 1; font-weight: 700; }
.jour.choisi { background: #fff6e0; box-shadow: inset 0 0 0 2px var(--laiton); }
.jour.butoir { background: repeating-linear-gradient(45deg, rgba(150, 44, 34, 0.12), rgba(150, 44, 34, 0.12) 4px, transparent 4px, transparent 8px); }
.numero { font-family: var(--f-cote); font-size: var(--t-s); }
.pastilles { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px; min-height: 8px; }
.pastille { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex: none; }
.pastille--fete { background: var(--laiton); }
.pastille--evenement { background: var(--rouge); }
.pastille--chronique { background: var(--vert); }
.pastille--note { background: var(--cristal, #4b6a8a); }
.pastille.cache { background: transparent; border: 1.5px dashed var(--encre-2); }
.legende { margin: 0; display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; font-size: var(--t-xs); color: var(--encre-2); }
.jour-choisi { display: flex; flex-direction: column; gap: 0.6rem; align-items: stretch; border-top: 1px dashed var(--papier-ombre); padding-top: 0.8rem; }
.jour-choisi > .bouton { align-self: flex-start; }
.jour-choisi h3 { font-size: 1.2rem; }
.vide { margin: 0; font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
.entree { padding: 0.5rem 0.8rem; border-left: 4px solid var(--papier-ombre); background: rgba(0, 0, 0, 0.03); }
.entree--fete { border-left-color: var(--laiton); }
.entree--evenement { border-left-color: var(--rouge); }
.entree--chronique { border-left-color: var(--vert); }
.entree--note { border-left-color: var(--cristal, #4b6a8a); }
.entree.cache { border-left-style: dashed; }
.entree p { margin: 0; }
.type { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.1em; color: var(--encre-2); }
.entree h4 { font-family: var(--f-titre); font-weight: 400; font-size: 1.2rem; }
.quand { font-size: var(--t-s); font-style: italic; color: var(--encre-2); }
.description { white-space: pre-line; line-height: 1.45; margin-top: 0.2rem !important; }
.actions { display: flex; gap: 0.8rem; margin-top: 0.3rem; }
.supprimer { color: var(--rouge); }
.cote { display: flex; flex-direction: column; gap: 1rem; }
.bloc { padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.lien-entree { display: flex; gap: 0.5rem; align-items: baseline; text-align: left; background: none; border: 0; padding: 0; color: var(--encre); width: 100%; font: inherit; cursor: pointer; }
.lien-entree strong { font-family: var(--f-titre); font-weight: 400; font-size: 1.05rem; }
.lien-entree small { font-family: var(--f-texte); font-style: italic; font-size: var(--t-s); }
.lien-entree span { display: flex; flex-direction: column; }
.lien-entree small { color: var(--encre-2); }
.lien-entree:hover strong { color: var(--ruban); }
.attente { color: #cdb48c; font-style: italic; }
.message--erreur { background: var(--papier); }
</style>
