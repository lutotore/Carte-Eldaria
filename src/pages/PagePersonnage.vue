<script setup>
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { api } from '../api/client.js'
import AptitudesRegles from '../components/personnage/AptitudesRegles.vue'
import BarreDeCombat from '../components/personnage/BarreDeCombat.vue'
import BoursePersonnage from '../components/personnage/BoursePersonnage.vue'
import ChoixEnRetard from '../components/personnage/ChoixEnRetard.vue'
import FichePersonnage from '../components/personnage/FichePersonnage.vue'
import ImportAideDD from '../components/personnage/ImportAideDD.vue'
import InventairePersonnage from '../components/personnage/InventairePersonnage.vue'
import MarquesDuReve from '../components/personnage/MarquesDuReve.vue'
import MonteeDeNiveau from '../components/personnage/MonteeDeNiveau.vue'
import SortsPersonnage from '../components/personnage/SortsPersonnage.vue'
import { utiliserEnvoi } from '../composables/envoi.js'

/**
 * Sans `personnageId` : la fiche du joueur connecté (ou de quoi la créer).
 * Avec : la fiche d'un joueur, ouverte par un MJ depuis la liste des personnages.
 */
const props = defineProps({
  id: { type: String, required: true },
  personnageId: { type: String, default: null },
})
const router = useRouter()

const personnage = ref(null)
const aCreer = ref(false)
const nom = ref('')
const confirmerSuppression = ref(false)
const chargement = utiliserEnvoi()
const { enCours, erreur, envoyer } = utiliserEnvoi()

async function lire(personnageId) {
  personnage.value = await api.personnage(props.id, personnageId)
  aCreer.value = false
}

const charger = () => chargement.envoyer(async () => {
  if (props.personnageId) return lire(Number(props.personnageId))
  const liste = await api.personnages(props.id)
  if (liste.estMj) return router.replace({ name: 'personnages', params: { id: props.id } })
  if (liste.personnageId === null) {
    personnage.value = null
    aCreer.value = true
    return undefined
  }
  return lire(liste.personnageId)
})
const recharger = () => chargement.envoyer(() => lire(personnage.value.id))
const apresImport = (personnageId) => chargement.envoyer(() => lire(personnageId))
onMounted(charger)
watch(() => [props.id, props.personnageId], charger)

const creer = () => envoyer(async () => {
  const { personnageId } = await api.creerPersonnage(props.id, nom.value)
  await lire(personnageId)
})

const supprimer = () => envoyer(async () => {
  await api.supprimerPersonnage(props.id, personnage.value.id)
  if (props.personnageId) await router.replace({ name: 'personnages', params: { id: props.id } })
  else {
    personnage.value = null
    aCreer.value = true
    confirmerSuppression.value = false
  }
})
</script>

<template>
  <main class="page-personnage">
    <RouterLink v-if="personnageId" :to="{ name: 'personnages', params: { id } }" class="retour">← Personnages</RouterLink>
    <p v-if="chargement.erreur.value" class="message message--erreur" role="alert">{{ chargement.erreur.value }}</p>

    <section v-if="aCreer" class="feuille papier epingle creation">
      <h1>Ta fiche de personnage</h1>
      <p class="chapeau">Elle n’est visible que de toi et des MJ. Tu la rempliras à ton rythme ; tout s’enregistre au fur et à mesure.</p>
      <form @submit.prevent="creer">
        <label class="champ">Nom du personnage <input v-model="nom" maxlength="80" required></label>
        <button type="submit" class="bouton bouton--plein" :disabled="enCours">Créer ma fiche</button>
      </form>
      <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
      <ImportAideDD :campagne-id="id" @importe="apresImport" />
    </section>

    <template v-else-if="personnage">
      <p v-if="personnage.estMj" class="bandeau">Fiche de <strong>{{ personnage.joueur }}</strong> — tu peux tout modifier ; le joueur voit tes changements.</p>
      <div class="outils">
        <MonteeDeNiveau :campagne-id="id" :personnage="personnage" @recharger="recharger" />
        <ImportAideDD :campagne-id="id" :personnage="personnage" @importe="apresImport" />
      </div>
      <BarreDeCombat :campagne-id="id" :personnage="personnage" @recharger="recharger" />
      <ChoixEnRetard :campagne-id="id" :personnage="personnage" @recharger="recharger" />

      <!-- Page 1 : la feuille -->
      <div id="feuille" class="page">
        <FichePersonnage :campagne-id="id" :personnage="personnage" @recharger="recharger" />
      </div>

      <!-- Page 2 : aptitudes et histoire -->
      <div id="aptitudes" class="page">
        <h2 class="titre-page">Aptitudes et histoire</h2>
        <AptitudesRegles v-if="personnage.regles" :regles="personnage.regles" />
        <MarquesDuReve :campagne-id="id" :personnage-id="personnage.id" :marques="personnage.marques" :est-mj="personnage.estMj" @recharger="recharger" />
        <FichePersonnage :campagne-id="id" :personnage="personnage" partie="recit" @recharger="recharger" />
      </div>

      <!-- Page 3 : sorts -->
      <div v-if="personnage.sorts?.length" id="sorts" class="page">
        <h2 class="titre-page">Sorts</h2>
        <SortsPersonnage :campagne-id="id" :personnage="personnage" @recharger="recharger" />
      </div>

      <!-- Équipement -->
      <div id="equipement" class="page">
        <h2 class="titre-page">Équipement</h2>
        <div class="annexes">
          <BoursePersonnage :campagne-id="id" :personnage-id="personnage.id" :bourse="personnage.bourse" @recharger="recharger" />
          <InventairePersonnage :campagne-id="id" :personnage-id="personnage.id" :lignes="personnage.inventaire" @recharger="recharger" />
        </div>
      </div>
      <div v-if="personnage.estMj" class="danger">
        <button v-if="!confirmerSuppression" type="button" class="lien-bouton supprimer" @click="confirmerSuppression = true">Supprimer cette fiche…</button>
        <span v-else class="confirmer">
          Supprimer la fiche, son inventaire, sa bourse et ses Marques ? C’est définitif.
          <button type="button" class="bouton bouton--rouge" :disabled="enCours" @click="supprimer">Oui, supprimer</button>
          <button type="button" class="lien-bouton" @click="confirmerSuppression = false">Non</button>
        </span>
      </div>
      <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
    </template>
    <p v-else-if="!chargement.erreur.value" class="attente">Ouverture de la fiche…</p>
  </main>
</template>

<style scoped>
.page-personnage { max-width: 1150px; margin: 0 auto; padding: 1.2rem max(16px, env(safe-area-inset-left)) 2rem; display: flex; flex-direction: column; gap: 1.2rem; }
.retour { color: #cdb48c; text-decoration: none; }
.retour:hover { color: var(--laiton-clair); }
.creation { max-width: 32rem; align-self: center; }
.bandeau { margin: 0; color: #e8d6b0; font-style: italic; }
.outils { display: flex; flex-direction: column; gap: 0.5rem; }
.page { display: flex; flex-direction: column; gap: 1rem; scroll-margin-top: 9rem; }
.titre-page { margin: 0.6rem 0 0; font-family: var(--f-titre); font-weight: normal; color: var(--laiton-clair); border-bottom: 1px solid var(--couture); padding-bottom: 0.2rem; }
.annexes { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); gap: 1.2rem; align-items: start; }
@media (max-width: 800px) { .annexes { grid-template-columns: minmax(0, 1fr); } }
.danger { display: flex; justify-content: flex-end; }
.supprimer { color: #e3a196; }
.confirmer { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; color: #e8d6b0; background: rgba(0, 0, 0, 0.3); padding: 0.4rem 0.7rem; border-radius: 4px; }
.attente { color: #cdb48c; font-style: italic; }
.message--erreur { background: var(--papier); }
</style>
