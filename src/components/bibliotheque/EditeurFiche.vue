<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, envoyerPortrait } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import { ATTITUDES, LIBELLES_FACETTES, STATUTS } from '../../domain/fiches.js'
import ControleRevelation from './ControleRevelation.vue'
import Portrait from './Portrait.vue'

const props = defineProps({
  campagneId: { type: String, required: true },
  fiche: { type: Object, required: true },
})
const emit = defineEmits(['recharger'])
const router = useRouter()

const { enCours, erreur, envoyer } = utiliserEnvoi()
const enregistre = ref('')
const nouveauSecret = ref({ titre: '', texte: '' })
const notesMj = ref(props.fiche.notesMj)
const confirmerSuppression = ref(false)

/** Chaque modification part aussitôt ; la fiche est rechargée pour refléter l'état du serveur. */
function action(travail, message = 'Enregistré.') {
  enregistre.value = ''
  return envoyer(async () => {
    await travail()
    emit('recharger')
    enregistre.value = message
  })
}

const modifier = (facette, valeur, titre) => {
  if (valeur === facette.valeur && (titre === undefined || titre === facette.titre)) return undefined
  return action(() => api.modifierFacette(props.campagneId, props.fiche.id, facette.id, valeur, titre))
}
const reveler = (facette, { pourTous, joueurs }) => action(() => api.reveler(props.campagneId, props.fiche.id, facette.id, pourTous, joueurs), 'Révélation mise à jour ; les joueurs concernés sont prévenus.')
const enregistrerNotesMj = () => notesMj.value !== props.fiche.notesMj && action(() => api.modifierNotesMj(props.campagneId, props.fiche.id, notesMj.value))
const ajouterSecret = () => action(async () => {
  await api.ajouterSecret(props.campagneId, props.fiche.id, nouveauSecret.value.titre, nouveauSecret.value.texte)
  nouveauSecret.value = { titre: '', texte: '' }
}, 'Secret ajouté (caché).')
const supprimerSecret = (facette) => action(() => api.supprimerSecret(props.campagneId, props.fiche.id, facette.id), 'Secret supprimé.')

function televerser(evenement) {
  const fichier = evenement.target.files?.[0]
  evenement.target.value = ''
  if (!fichier) return undefined
  if (fichier.size > 5 * 1024 * 1024) {
    erreur.value = 'Image trop lourde (5 Mo au plus).'
    return undefined
  }
  return action(() => envoyerPortrait(props.campagneId, props.fiche.id, fichier), 'Portrait enregistré (caché tant que tu ne le révèles pas).')
}

const supprimerFiche = () => envoyer(async () => {
  await api.supprimerFiche(props.campagneId, props.fiche.id)
  await router.replace({ name: 'bibliotheque', params: { id: props.campagneId } })
})

const facettesFixes = () => props.fiche.facettes.filter((f) => f.cle !== 'secret')
const secrets = () => props.fiche.facettes.filter((f) => f.cle === 'secret')
</script>

<template>
  <section class="editeur papier epingle" aria-labelledby="titre-fiche">
    <p class="petites-capitales">Fiche du MJ</p>
    <h1 id="titre-fiche">{{ fiche.facettes.find((f) => f.cle === 'nom').valeur }}</h1>
    <p class="aide">Chaque information est cachée tant que tu ne la révèles pas, au groupe ou à certains joueurs. Les notes du MJ ne sont jamais montrées.</p>
    <p class="statut" aria-live="polite">
      <span v-if="erreur" class="message message--erreur">{{ erreur }}</span>
      <span v-else-if="enregistre" class="message message--ok">{{ enregistre }}</span>
    </p>

    <div v-for="f in facettesFixes()" :key="f.id" class="facette">
      <div class="saisie">
        <span class="libelle">{{ LIBELLES_FACETTES[f.cle] }}</span>
        <template v-if="f.cle === 'portrait'">
          <div class="portrait-ligne">
            <Portrait :campagne-id="campagneId" :image-id="f.valeur || null" taille="grand" />
            <label class="bouton">Choisir une image… <input type="file" accept="image/png,image/jpeg,image/webp" class="visuellement-cache" @change="televerser"></label>
          </div>
        </template>
        <select v-else-if="f.cle === 'attitude' || f.cle === 'statut'" :value="f.valeur" :aria-label="LIBELLES_FACETTES[f.cle]" @change="modifier(f, $event.target.value)">
          <option value="">—</option>
          <option v-for="o in (f.cle === 'attitude' ? ATTITUDES : STATUTS)" :key="o.cle" :value="o.cle">{{ o.nom }}</option>
        </select>
        <textarea v-else-if="f.cle === 'description'" :value="f.valeur" rows="4" maxlength="4000" :aria-label="LIBELLES_FACETTES[f.cle]" @change="modifier(f, $event.target.value)" />
        <input v-else type="text" :value="f.valeur" :maxlength="f.cle === 'nom' ? 80 : 200" :aria-label="LIBELLES_FACETTES[f.cle]" @change="modifier(f, $event.target.value)">
      </div>
      <ControleRevelation :revelations="f.revelations" :joueurs="fiche.joueurs" :vide="!f.valeur" :en-cours="enCours" @changer="reveler(f, $event)" />
    </div>

    <h2>Secrets</h2>
    <div v-for="f in secrets()" :key="f.id" class="facette secret">
      <div class="saisie">
        <input type="text" :value="f.titre" maxlength="80" aria-label="Titre du secret" @change="modifier(f, f.valeur, $event.target.value)">
        <textarea :value="f.valeur" rows="3" maxlength="4000" aria-label="Texte du secret" @change="modifier(f, $event.target.value)" />
      </div>
      <div class="pied-secret">
        <ControleRevelation :revelations="f.revelations" :joueurs="fiche.joueurs" :en-cours="enCours" @changer="reveler(f, $event)" />
        <button type="button" class="lien-bouton supprimer" @click="supprimerSecret(f)">Supprimer ce secret</button>
      </div>
    </div>
    <form class="nouveau-secret" @submit.prevent="ajouterSecret">
      <input v-model="nouveauSecret.titre" type="text" maxlength="80" placeholder="Titre du secret" required aria-label="Titre du nouveau secret">
      <textarea v-model="nouveauSecret.texte" rows="2" maxlength="4000" placeholder="Ce que les joueurs pourront découvrir" required aria-label="Texte du nouveau secret" />
      <button type="submit" class="bouton" :disabled="enCours">Ajouter un secret</button>
    </form>

    <h2>Notes du MJ</h2>
    <textarea v-model="notesMj" class="notes-mj" rows="6" maxlength="20000" aria-label="Notes du MJ, jamais visibles des joueurs" @blur="enregistrerNotesMj" />

    <div class="danger">
      <button v-if="!confirmerSuppression" type="button" class="lien-bouton supprimer" @click="confirmerSuppression = true">Supprimer cette fiche…</button>
      <span v-else class="confirmer">
        Supprimer la fiche, son portrait et les notes des joueurs ?
        <button type="button" class="bouton bouton--rouge" :disabled="enCours" @click="supprimerFiche">Oui, supprimer</button>
        <button type="button" class="lien-bouton" @click="confirmerSuppression = false">Non</button>
      </span>
    </div>
  </section>
</template>

<style scoped>
.editeur { padding: 2rem 1.6rem 1.4rem; display: flex; flex-direction: column; gap: 0.9rem; }
.editeur .petites-capitales { margin: 0; color: var(--encre-2); }
h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); color: var(--encre); }
h2 { font-size: 1.35rem; color: var(--encre); margin-top: 0.6rem; }
.aide { margin: 0; font-style: italic; color: var(--encre-2); font-size: var(--t-s); }
.statut { margin: 0; min-height: 1.5rem; }
.facette { display: flex; flex-direction: column; gap: 0.35rem; padding-bottom: 0.8rem; border-bottom: 1px dashed var(--papier-ombre); }
.saisie { display: grid; grid-template-columns: 11rem minmax(0, 1fr); gap: 0.6rem; align-items: start; }
@media (max-width: 640px) { .saisie { grid-template-columns: minmax(0, 1fr); } }
.libelle { font-family: var(--f-titre); font-size: 1.05rem; padding-top: 0.25rem; }
.secret .saisie { grid-template-columns: minmax(0, 1fr); }
input[type='text'], select, textarea { border: 1px solid var(--papier-ombre); border-radius: 3px; background: #f6ecd4; padding: 0.4rem 0.55rem; color: var(--encre); width: 100%; }
select { width: auto; }
textarea { resize: vertical; }
.portrait-ligne { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; }
.pied-secret { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.4rem 1rem; align-items: center; }
.nouveau-secret { display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-start; }
.notes-mj { min-height: 8rem; }
.supprimer { color: var(--rouge); }
.danger { display: flex; justify-content: flex-end; margin-top: 0.6rem; }
.confirmer { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; color: var(--rouge); }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
