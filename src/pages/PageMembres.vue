<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api/client.js'
import { NOMS_ROLES } from '../api/droits.js'
import { utiliserEnvoi } from '../composables/envoi.js'
import { moi } from '../session.js'

const props = defineProps({ id: { type: String, required: true } })

const ROLES_INVITABLES = ['joueur', 'occasionnel', 'mj']
const membres = ref([])
const role = ref('joueur')
/** Dernier lien produit : { titre, lien, expireLe }. */
const lienProduit = ref(null)
const copie = ref(false)
/** Membre dont le retrait attend une confirmation. */
const aRetirer = ref(null)
const { enCours, erreur, envoyer } = utiliserEnvoi()

const dateCourte = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const dateLongue = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })

const charger = () => envoyer(async () => { membres.value = await api.membres(props.id) })
onMounted(charger)

function montrerLien(titre, { lien, expireLe }) {
  lienProduit.value = { titre, lien, expireLe }
  copie.value = false
}

const inviter = () => envoyer(async () => {
  montrerLien(`Invitation : ${NOMS_ROLES[role.value]}`, await api.inviter(props.id, role.value))
})

const reinitialiser = (membre) => envoyer(async () => {
  montrerLien(`Nouveau mot de passe pour ${membre.identifiant}`, await api.lienReinitialisation(props.id, membre.id))
})

const retirer = (membre) => envoyer(async () => {
  await api.retirerMembre(props.id, membre.id)
  aRetirer.value = null
  membres.value = await api.membres(props.id)
})

async function copier() {
  try {
    await navigator.clipboard.writeText(lienProduit.value.lien)
    copie.value = true
  } catch {
    copie.value = false
  }
}
</script>

<template>
  <main class="page-feuille">
    <section class="feuille feuille--large papier epingle" aria-labelledby="titre">
      <h1 id="titre">Membres de la campagne</h1>

      <form class="inviter" @submit.prevent="inviter">
        <label class="champ">Inviter quelqu'un comme
          <select v-model="role">
            <option v-for="r in ROLES_INVITABLES" :key="r" :value="r">{{ NOMS_ROLES[r] }}</option>
          </select>
        </label>
        <button type="submit" class="bouton bouton--plein" :disabled="enCours">Créer un lien d'invitation</button>
      </form>

      <div v-if="lienProduit" class="lien-produit" role="status">
        <p><strong>{{ lienProduit.titre }}</strong> — à usage unique, valable jusqu'au {{ dateLongue(lienProduit.expireLe) }}.</p>
        <div class="copie">
          <input :value="lienProduit.lien" readonly aria-label="Lien à envoyer" @focus="$event.target.select()">
          <button type="button" class="bouton" @click="copier">{{ copie ? 'Copié' : 'Copier' }}</button>
        </div>
        <p class="chapeau">Envoie-le par le moyen que tu veux (message, Discord…). Quiconque l'ouvre en premier l'utilise.</p>
      </div>

      <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>

      <div class="tableau">
        <table>
          <thead><tr><th scope="col">Identifiant</th><th scope="col">Rôle</th><th scope="col">Depuis le</th><th scope="col"><span class="visuellement-cache">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="m in membres" :key="m.id">
              <td>{{ m.identifiant }}</td>
              <td>{{ NOMS_ROLES[m.role] }}</td>
              <td>{{ dateCourte(m.rejointLe) }}</td>
              <td class="actions-ligne">
                <button type="button" class="lien-bouton" :disabled="enCours" @click="reinitialiser(m)">Lien de mot de passe</button>
                <template v-if="m.id !== moi.id">
                  <button v-if="aRetirer !== m.id" type="button" class="lien-bouton retirer" @click="aRetirer = m.id">Retirer</button>
                  <span v-else class="confirmer">
                    Retirer {{ m.identifiant }} ?
                    <button type="button" class="bouton bouton--rouge" :disabled="enCours" @click="retirer(m)">Oui, retirer</button>
                    <button type="button" class="lien-bouton" @click="aRetirer = null">Annuler</button>
                  </span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.inviter { flex-direction: row !important; flex-wrap: wrap; align-items: flex-end; }
.lien-produit { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.8rem 1rem; border: 1px dashed var(--encre-2); }
.copie { display: flex; gap: 0.5rem; }
.copie input { flex: 1; min-width: 0; font-family: var(--f-cote); font-size: var(--t-s); padding: 0.4rem 0.5rem; border: 1px solid var(--papier-ombre); background: #f6ecd4; color: var(--encre); border-radius: 3px; }
.tableau { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-weight: 400; font-style: italic; color: var(--encre-2); border-bottom: 1.5px solid var(--encre); padding: 0.3rem 0.5rem; white-space: nowrap; }
td { border-bottom: 1px solid rgba(45, 31, 21, 0.18); padding: 0.5rem; vertical-align: middle; }
.actions-ligne { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; align-items: center; justify-content: flex-end; }
.retirer { color: var(--rouge); }
.confirmer { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; color: var(--rouge); }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
