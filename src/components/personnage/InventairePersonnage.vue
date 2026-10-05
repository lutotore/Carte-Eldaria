<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import { LONGUEURS_LIGNE } from '../../domain/personnage.js'

/** L'inventaire : ce que le personnage porte. Un objet venu d'un butin mène à sa fiche, une fois identifié. */
const props = defineProps({
  campagneId: { type: String, required: true },
  personnageId: { type: Number, required: true },
  lignes: { type: Array, required: true },
})
const emit = defineEmits(['recharger'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const nouvelle = ref({ libelle: '', quantite: 1, notes: '' })
const confirmer = ref(null)

const agir = (action) => envoyer(async () => {
  await action()
  emit('recharger')
})

const ajouter = () => agir(async () => {
  await api.ajouterLigne(props.campagneId, props.personnageId, nouvelle.value)
  nouvelle.value = { libelle: '', quantite: 1, notes: '' }
})

/** Un champ modifié part avec le reste de la ligne. */
function modifier(ligne, cle, valeur) {
  const changee = { libelle: ligne.libelle, quantite: ligne.quantite, notes: ligne.notes, [cle]: valeur }
  if (changee[cle] === ligne[cle]) return undefined
  return agir(() => api.modifierLigne(props.campagneId, props.personnageId, ligne.id, changee))
}

/** Une saisie invalide (quantité nulle, nom vide) reprend simplement l'ancienne valeur. */
function changerQuantite(ligne, evenement) {
  const quantite = Number(evenement.target.value)
  if (Number.isInteger(quantite) && quantite >= 1 && quantite <= 9999) return modifier(ligne, 'quantite', quantite)
  evenement.target.value = ligne.quantite
  return undefined
}

function changerLibelle(ligne, evenement) {
  const libelle = evenement.target.value.trim()
  if (libelle) return modifier(ligne, 'libelle', libelle)
  evenement.target.value = ligne.libelle
  return undefined
}

const supprimer = (ligne) => agir(async () => {
  await api.supprimerLigne(props.campagneId, props.personnageId, ligne.id)
  confirmer.value = null
})
</script>

<template>
  <section class="inventaire papier" aria-labelledby="titre-inventaire">
    <h2 id="titre-inventaire">Inventaire</h2>
    <p v-if="!lignes.length" class="vide">Rien pour l’instant. Ajoute ton équipement ci-dessous, ou sers-toi dans un butin.</p>
    <ul class="lignes">
      <li v-for="l in lignes" :key="l.id" class="ligne">
        <input
          type="number" min="1" max="9999" class="quantite" :value="l.quantite" :aria-label="`Quantité : ${l.libelle}`"
          @change="changerQuantite(l, $event)"
        >
        <div class="corps">
          <input class="libelle" :value="l.libelle" :maxlength="LONGUEURS_LIGNE.libelle" :aria-label="`Nom : ${l.libelle}`" @change="changerLibelle(l, $event)">
          <RouterLink v-if="l.objet" :to="{ name: 'objet', params: { id: campagneId, ficheId: l.objet.id } }" class="objet">
            {{ l.objet.nom ? `Identifié : ${l.objet.nom}` : 'Ce que tu sais de cet objet' }} →
          </RouterLink>
          <input class="notes" :value="l.notes" :maxlength="LONGUEURS_LIGNE.notes" placeholder="Notes…" :aria-label="`Notes : ${l.libelle}`" @change="modifier(l, 'notes', $event.target.value)">
        </div>
        <button v-if="confirmer !== l.id" type="button" class="lien-bouton retirer" @click="confirmer = l.id">Retirer</button>
        <span v-else class="confirmer">
          <button type="button" class="bouton bouton--rouge" :disabled="enCours" @click="supprimer(l)">Oui, retirer</button>
          <button type="button" class="lien-bouton" @click="confirmer = null">Non</button>
        </span>
      </li>
    </ul>

    <form class="ajout" @submit.prevent="ajouter">
      <label class="champ quantite-ajout">Qté <input v-model.number="nouvelle.quantite" type="number" min="1" max="9999" required></label>
      <label class="champ libelle-ajout">Objet <input v-model="nouvelle.libelle" :maxlength="LONGUEURS_LIGNE.libelle" required placeholder="Corde de chanvre (15 m)"></label>
      <button type="submit" class="bouton" :disabled="enCours">Ajouter</button>
    </form>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
  </section>
</template>

<style scoped>
.inventaire { padding: 1.2rem 1.2rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
h2 { font-size: 1.35rem; }
.vide { margin: 0; font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
.lignes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.ligne { display: grid; grid-template-columns: 3.6rem minmax(0, 1fr) auto; gap: 0.6rem; align-items: start; padding: 0.45rem 0; border-bottom: 1px dashed var(--papier-ombre); }
.corps { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
input { border: 1px solid transparent; border-radius: 3px; background: transparent; color: var(--encre); padding: 0.15rem 0.3rem; width: 100%; }
input:hover, input:focus { border-color: var(--papier-ombre); background: #f6ecd4; }
.quantite { text-align: center; font-family: var(--f-cote); }
.libelle { font-weight: 700; }
.notes { font-size: var(--t-s); font-style: italic; color: var(--encre-2); }
.objet { font-size: var(--t-s); color: var(--ruban); padding-left: 0.3rem; }
.retirer { color: var(--rouge); font-size: var(--t-s); }
.confirmer { display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-end; }
.ajout { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr) auto; gap: 0.5rem; align-items: end; }
.ajout input { border-color: var(--papier-ombre); background: #f6ecd4; }
</style>
