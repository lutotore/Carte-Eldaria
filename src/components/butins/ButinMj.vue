<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import { PIECES } from '../../domain/personnage.js'

/** Un butin côté MJ : se prépare en secret, s'ouvre aux joueurs, se ferme. */
const props = defineProps({
  campagneId: { type: String, required: true },
  butin: { type: Object, required: true },
  /** Fiches d'objets de la bibliothèque, pour relier un objet à son identification. */
  objetsBibliotheque: { type: Array, default: () => [] },
})
const emit = defineEmits(['recharger'])
const { enCours, erreur, envoyer } = utiliserEnvoi()
const fait = ref('')

const ETATS = { prepare: 'En préparation', ouvert: 'Ouvert aux joueurs', clos: 'Fermé' }
const copie = () => ({ titre: props.butin.titre, notesMj: props.butin.notesMj, pieces: { ...props.butin.pieces } })
const contenu = ref(copie())
/** Dernière version reçue du serveur : une saisie en cours, non enregistrée, survit au rechargement de la page. */
let recu = JSON.stringify(copie())
watch(() => props.butin, () => {
  const nouveau = JSON.stringify(copie())
  if (JSON.stringify(contenu.value) === recu) contenu.value = copie()
  recu = nouveau
})
const modifie = computed(() => JSON.stringify(contenu.value) !== JSON.stringify(copie()))
const nouvelObjet = ref({ libelle: '', quantite: 1, description: '', ficheId: null })
const confirmerSuppression = ref(false)

const agir = (action, message) => envoyer(async () => {
  fait.value = ''
  await action()
  emit('recharger')
  fait.value = message
})

const enregistrer = () => agir(() => api.modifierButin(props.campagneId, props.butin.id, contenu.value), 'Butin enregistré.')
const statut = (s) => agir(() => api.changerStatutButin(props.campagneId, props.butin.id, s),
  s === 'ouvert' ? 'Butin ouvert : les joueurs sont prévenus et peuvent se servir.' : s === 'clos' ? 'Butin fermé : les joueurs ne le voient plus.' : 'Butin repassé en préparation.')
const ajouterObjet = () => agir(async () => {
  await api.ajouterObjetButin(props.campagneId, props.butin.id, nouvelObjet.value)
  nouvelObjet.value = { libelle: '', quantite: 1, description: '', ficheId: null }
}, 'Objet ajouté.')
function modifierObjet(objet, cle, valeur) {
  const changee = { libelle: objet.libelle, quantite: objet.quantite, description: objet.description, ficheId: objet.objet?.id ?? null, [cle]: valeur }
  return agir(() => api.modifierObjetButin(props.campagneId, props.butin.id, objet.id, changee), 'Objet enregistré.')
}
const supprimerObjet = (objet) => agir(() => api.supprimerObjetButin(props.campagneId, props.butin.id, objet.id), 'Objet retiré.')
const supprimer = () => agir(() => api.supprimerButin(props.campagneId, props.butin.id), 'Butin supprimé.')

function quantite(objet, evenement) {
  const valeur = Number(evenement.target.value)
  if (Number.isInteger(valeur) && valeur >= 0 && valeur <= 9999) return modifierObjet(objet, 'quantite', valeur)
  evenement.target.value = objet.quantite
  return undefined
}
const ficheChoisie = (evenement) => (evenement.target.value === '' ? null : Number(evenement.target.value))
const heure = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <article class="butin papier" :class="`butin--${butin.statut}`">
    <header class="entete">
      <span class="etat">{{ ETATS[butin.statut] }}</span>
      <div class="boutons">
        <button v-if="butin.statut !== 'ouvert'" type="button" class="bouton bouton--plein" :disabled="enCours" @click="statut('ouvert')">
          {{ butin.statut === 'clos' ? 'Rouvrir aux joueurs' : 'Ouvrir aux joueurs' }}
        </button>
        <button v-if="butin.statut === 'ouvert'" type="button" class="bouton" :disabled="enCours" @click="statut('clos')">Fermer</button>
        <button v-if="butin.statut === 'clos'" type="button" class="lien-bouton" :disabled="enCours" @click="statut('prepare')">Repasser en préparation</button>
      </div>
    </header>

    <form class="contenu" @submit.prevent="enregistrer">
      <label class="champ titre">Rencontre <input v-model="contenu.titre" maxlength="120" required></label>
      <div class="pieces">
        <label v-for="p in PIECES" :key="p.cle" class="champ">{{ p.cle }} <input v-model.number="contenu.pieces[p.cle]" type="number" min="0"></label>
      </div>
      <label class="champ">Notes du MJ (jamais montrées) <textarea v-model="contenu.notesMj" rows="2" maxlength="20000" /></label>
      <button v-if="modifie" type="submit" class="bouton bouton--plein" :disabled="enCours">Enregistrer</button>
    </form>

    <h3>Objets</h3>
    <p v-if="!butin.objets.length" class="aide">Aucun objet.</p>
    <div v-for="o in butin.objets" :key="o.id" class="objet">
      <input type="number" min="0" max="9999" class="qte" :value="o.quantite" :aria-label="`Quantité restante : ${o.libelle}`" @change="quantite(o, $event)">
      <div class="champs-objet">
        <input :value="o.libelle" maxlength="120" :aria-label="`Libellé vu des joueurs : ${o.libelle}`" @change="$event.target.value.trim() && modifierObjet(o, 'libelle', $event.target.value.trim())">
        <input :value="o.description" maxlength="1000" placeholder="Description (copiée dans l’inventaire)" :aria-label="`Description : ${o.libelle}`" @change="modifierObjet(o, 'description', $event.target.value)">
        <select :value="o.objet?.id ?? ''" :aria-label="`Fiche d’objet reliée : ${o.libelle}`" @change="modifierObjet(o, 'ficheId', ficheChoisie($event))">
          <option value="">— aucune fiche d’objet —</option>
          <option v-for="f in objetsBibliotheque" :key="f.id" :value="f.id">{{ f.nom }}</option>
        </select>
      </div>
      <button type="button" class="lien-bouton retirer" @click="supprimerObjet(o)">Retirer</button>
    </div>
    <p v-if="butin.objets.some((o) => o.quantite === 0)" class="aide">Un objet à 0 a été entièrement pris.</p>

    <form class="ajout" @submit.prevent="ajouterObjet">
      <input v-model.number="nouvelObjet.quantite" type="number" min="1" max="9999" class="qte" aria-label="Quantité" required>
      <input v-model="nouvelObjet.libelle" maxlength="120" placeholder="Objet, tel que les joueurs le verront" aria-label="Nouvel objet" required>
      <select v-model="nouvelObjet.ficheId" aria-label="Fiche d’objet reliée">
        <option :value="null">— aucune fiche —</option>
        <option v-for="f in objetsBibliotheque" :key="f.id" :value="f.id">{{ f.nom }}</option>
      </select>
      <button type="submit" class="bouton" :disabled="enCours">Ajouter</button>
    </form>

    <p class="statut" aria-live="polite">
      <span v-if="erreur" class="message message--erreur">{{ erreur }}</span>
      <span v-else-if="fait" class="message message--ok">{{ fait }}</span>
    </p>

    <details v-if="butin.prises.length" class="journal">
      <summary>Qui a pris quoi ({{ butin.prises.length }})</summary>
      <ul>
        <li v-for="(p, i) in butin.prises" :key="i"><time :datetime="p.le">{{ heure(p.le) }}</time> — {{ p.texte }}</li>
      </ul>
    </details>

    <div class="danger">
      <button v-if="!confirmerSuppression" type="button" class="lien-bouton retirer" @click="confirmerSuppression = true">Supprimer ce butin…</button>
      <span v-else class="confirmer">
        Supprimer le butin et son journal ? Ce que les joueurs ont pris reste dans leur fiche.
        <button type="button" class="bouton bouton--rouge" :disabled="enCours" @click="supprimer">Oui, supprimer</button>
        <button type="button" class="lien-bouton" @click="confirmerSuppression = false">Non</button>
      </span>
    </div>
  </article>
</template>

<style scoped>
.butin { padding: 1.2rem 1.2rem 1rem; display: flex; flex-direction: column; gap: 0.7rem; border-left: 5px solid var(--papier-ombre); }
.butin--ouvert { border-left-color: var(--vert); }
.butin--clos { opacity: 0.85; }
.entete { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem; align-items: center; }
.etat { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; color: var(--encre-2); }
.butin--ouvert .etat { color: var(--vert); }
.boutons { display: flex; gap: 0.5rem; align-items: center; }
.contenu { display: flex; flex-direction: column; gap: 0.5rem; align-items: stretch; }
.contenu .bouton { align-self: flex-start; }
.titre input { font-family: var(--f-titre); font-size: 1.3rem; }
.pieces { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.pieces input { width: 5rem; }
h3 { font-size: 1.1rem; color: var(--ruban); }
.aide { margin: 0; font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
.objet, .ajout { display: grid; grid-template-columns: 4rem minmax(0, 1fr) auto; gap: 0.5rem; align-items: start; }
.objet { padding-bottom: 0.5rem; border-bottom: 1px dashed var(--papier-ombre); }
.ajout { grid-template-columns: 4rem minmax(0, 1fr) minmax(0, 0.8fr) auto; }
@media (max-width: 640px) { .ajout { grid-template-columns: 4rem minmax(0, 1fr); } }
.champs-objet { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.objet input, .objet select, .ajout input, .ajout select { border: 1px solid var(--papier-ombre); border-radius: 3px; background: #f6ecd4; color: var(--encre); padding: 0.25rem 0.4rem; width: 100%; min-width: 0; }
.qte { text-align: center; font-family: var(--f-cote); }
.retirer { color: var(--rouge); font-size: var(--t-s); }
.statut { margin: 0; min-height: 1.4rem; }
.journal { font-size: var(--t-s); color: var(--encre-2); }
.journal ul { margin: 0.3rem 0 0; padding-left: 1.1rem; }
.danger { display: flex; justify-content: flex-end; }
.confirmer { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; color: var(--rouge); font-size: var(--t-s); }
</style>
