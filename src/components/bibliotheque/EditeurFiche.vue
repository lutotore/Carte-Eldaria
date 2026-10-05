<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, envoyerPortrait } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import { ATTITUDES, libelleFacette, longueurMax, SECTIONS_TITREES, STATUTS, TITREES_PAR_TYPE } from '../../domain/fiches.js'
import ControleRevelation from './ControleRevelation.vue'
import Portrait from './Portrait.vue'
import { rubriqueDe } from './rubriques.js'

const props = defineProps({
  campagneId: { type: String, required: true },
  fiche: { type: Object, required: true },
})
const emit = defineEmits(['recharger'])
const router = useRouter()

const { enCours, erreur, envoyer } = utiliserEnvoi()
const enregistre = ref('')
const titrees = TITREES_PAR_TYPE[props.fiche.type]
const rubrique = rubriqueDe(props.fiche.type)
const estDocument = props.fiche.type === 'document'
const libelle = (cle) => libelleFacette(props.fiche.type, cle)
const nouvelElement = ref({ cle: titrees[0], titre: '', texte: '' })
const confirmerToutReveler = ref(false)
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
const ajouterElement = () => action(async () => {
  const { cle, titre, texte } = nouvelElement.value
  await api.ajouterElement(props.campagneId, props.fiche.id, cle, titre, texte)
  nouvelElement.value = { cle, titre: '', texte: '' }
}, 'Ajouté (caché).')
const supprimerElement = (facette) => action(() => api.supprimerSecret(props.campagneId, props.fiche.id, facette.id), 'Supprimé.')
const toutReveler = () => action(async () => {
  await api.revelerTout(props.campagneId, props.fiche.id)
  confirmerToutReveler.value = false
}, 'Tout ce qui est rempli est révélé au groupe ; les joueurs sont prévenus.')

const TAILLE_MAX = estDocument ? 10 : 5
const FORMATS = estDocument ? 'image/png,image/jpeg,image/webp,application/pdf' : 'image/png,image/jpeg,image/webp'

function televerser(evenement) {
  const fichier = evenement.target.files?.[0]
  evenement.target.value = ''
  if (!fichier) return undefined
  if (fichier.size > TAILLE_MAX * 1024 * 1024) {
    erreur.value = `Fichier trop lourd (${TAILLE_MAX} Mo au plus).`
    return undefined
  }
  return action(() => envoyerPortrait(props.campagneId, props.fiche.id, fichier, estDocument), 'Fichier enregistré (caché tant que tu ne le révèles pas).')
}

const changerIle = (ile) => action(() => api.changerIle(props.campagneId, props.fiche.id, ile), ile ? 'Lieu placé sur la carte.' : 'Lieu détaché de la carte.')

const supprimerFiche = () => envoyer(async () => {
  await api.supprimerFiche(props.campagneId, props.fiche.id)
  await router.replace({ name: rubrique.liste, params: { id: props.campagneId } })
})

const facettesFixes = () => props.fiche.facettes.filter((f) => !titrees.includes(f.cle))
const elementsDe = (cle) => props.fiche.facettes.filter((f) => f.cle === cle)
const estimation = (cle) => props.fiche.estimations?.[cle] ?? null
const TEXTES_LONGS = ['description', 'ambiance', 'acces', 'apparence', 'texte']
</script>

<template>
  <section class="editeur papier epingle" aria-labelledby="titre-fiche">
    <p class="petites-capitales">{{ rubrique.nature }} — fiche du MJ</p>
    <h1 id="titre-fiche">{{ fiche.facettes.find((f) => f.cle === 'nom').valeur }}</h1>
    <p class="aide">Chaque information est cachée tant que tu ne la révèles pas, au groupe ou à certains joueurs. Les notes du MJ ne sont jamais montrées.</p>
    <div class="tout-reveler">
      <button v-if="!confirmerToutReveler" type="button" class="bouton" @click="confirmerToutReveler = true">Tout révéler au groupe…</button>
      <span v-else class="confirmer-vert">
        Révéler au groupe tout ce qui est rempli (sauf tes notes MJ) ?
        <button type="button" class="bouton bouton--plein" :disabled="enCours" @click="toutReveler">Oui, tout révéler</button>
        <button type="button" class="lien-bouton" @click="confirmerToutReveler = false">Non</button>
      </span>
    </div>
    <label v-if="fiche.type === 'lieu'" class="ile">
      <span class="libelle">Sur la carte</span>
      <select :value="fiche.ile ?? ''" aria-describedby="aide-ile" @change="changerIle($event.target.value)">
        <option value="">— aucune île —</option>
        <option v-for="i in fiche.iles" :key="i.id" :value="i.id">{{ i.nom }}</option>
      </select>
      <small id="aide-ile" class="aide">Les joueurs qui connaissent ce lieu le retrouvent dans la fiche de l’île, une fois l’île révélée.</small>
    </label>
    <p class="statut" aria-live="polite">
      <span v-if="erreur" class="message message--erreur">{{ erreur }}</span>
      <span v-else-if="enregistre" class="message message--ok">{{ enregistre }}</span>
    </p>

    <div v-for="f in facettesFixes()" :key="f.id" class="facette">
      <div class="saisie">
        <span class="libelle">{{ libelle(f.cle) }}</span>
        <template v-if="f.cle === 'portrait' || f.cle === 'fichier'">
          <div class="portrait-ligne">
            <a v-if="fiche.typeFichier === 'application/pdf'" :href="api.urlImage(campagneId, f.valeur)" class="pdf" download>Télécharger le PDF</a>
            <Portrait v-else :campagne-id="campagneId" :image-id="f.valeur || null" :nom="fiche.facettes.find((x) => x.cle === 'nom').valeur" :genre="fiche.type" taille="grand" />
            <label class="bouton">{{ estDocument ? 'Choisir une image ou un PDF…' : 'Choisir une image…' }} <input type="file" :accept="FORMATS" class="visuellement-cache" @change="televerser"></label>
          </div>
        </template>
        <select v-else-if="f.cle === 'attitude' || f.cle === 'statut'" :value="f.valeur" :aria-label="libelle(f.cle)" @change="modifier(f, $event.target.value)">
          <option value="">—</option>
          <option v-for="o in (f.cle === 'attitude' ? ATTITUDES : STATUTS)" :key="o.cle" :value="o.cle">{{ o.nom }}</option>
        </select>
        <textarea v-else-if="TEXTES_LONGS.includes(f.cle)" :value="f.valeur" :rows="f.cle === 'texte' ? 12 : 4" :maxlength="longueurMax(f.cle)" :aria-label="libelle(f.cle)" @change="modifier(f, $event.target.value)" />
        <input v-else type="text" :value="f.valeur" :maxlength="longueurMax(f.cle)" :aria-label="libelle(f.cle)" @change="modifier(f, $event.target.value)">
      </div>
      <p v-if="estimation(f.cle)" class="estimation-joueurs">Estimation des joueurs : « {{ estimation(f.cle).texte }} » ({{ estimation(f.cle).auteur }})</p>
      <ControleRevelation :revelations="f.revelations" :joueurs="fiche.joueurs" :vide="!f.valeur" :en-cours="enCours" @changer="reveler(f, $event)" />
    </div>

    <template v-for="cle in titrees" :key="cle">
      <h2>{{ SECTIONS_TITREES[cle] }}</h2>
      <p v-if="!elementsDe(cle).length" class="aide">Aucun pour l'instant.</p>
      <div v-for="f in elementsDe(cle)" :key="f.id" class="facette secret">
        <div class="saisie">
          <input type="text" :value="f.titre" maxlength="80" :aria-label="`Titre : ${libelle(cle)}`" @change="modifier(f, f.valeur, $event.target.value)">
          <textarea :value="f.valeur" rows="3" maxlength="4000" :aria-label="`Texte : ${libelle(cle)}`" @change="modifier(f, $event.target.value)" />
        </div>
        <div class="pied-secret">
          <ControleRevelation :revelations="f.revelations" :joueurs="fiche.joueurs" :en-cours="enCours" @changer="reveler(f, $event)" />
          <button type="button" class="lien-bouton supprimer" @click="supprimerElement(f)">Supprimer</button>
        </div>
      </div>
    </template>
    <form v-if="titrees.length" class="nouveau-secret" @submit.prevent="ajouterElement">
      <h2>Ajouter</h2>
      <select v-if="titrees.length > 1" v-model="nouvelElement.cle" aria-label="Type d'élément">
        <option v-for="cle in titrees" :key="cle" :value="cle">{{ libelle(cle) }}</option>
      </select>
      <input v-model="nouvelElement.titre" type="text" maxlength="80" placeholder="Titre" required aria-label="Titre du nouvel élément">
      <textarea v-model="nouvelElement.texte" rows="2" maxlength="4000" placeholder="Texte (ce que les joueurs pourront découvrir)" required aria-label="Texte du nouvel élément" />
      <button type="submit" class="bouton" :disabled="enCours">Ajouter (caché)</button>
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
.ile { display: grid; grid-template-columns: 11rem minmax(0, 1fr); gap: 0.2rem 0.6rem; align-items: center; }
.ile .aide { grid-column: 2; }
@media (max-width: 640px) { .ile { grid-template-columns: minmax(0, 1fr); } .ile .aide { grid-column: 1; } }
.pdf { font-family: var(--f-titre); font-size: 1.1rem; color: var(--ruban); }
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
.tout-reveler { display: flex; }
.confirmer-vert { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; color: var(--vert); }
.estimation-joueurs { margin: 0; font-size: var(--t-s); font-style: italic; color: var(--cristal); }
.confirmer { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; color: var(--rouge); }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
