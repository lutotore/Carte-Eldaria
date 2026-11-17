<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import { PIECES } from '../../domain/personnage.js'

/**
 * Un butin ouvert, côté joueur, pensé pour le téléphone : « Prendre ma part » en un geste pour les pièces,
 * « Prendre » pour chaque objet. La prise de pièces à la main reste possible, repliée.
 */
const props = defineProps({
  campagneId: { type: String, required: true },
  butin: { type: Object, required: true },
  peutPrendre: { type: Boolean, default: false },
})
const emit = defineEmits(['recharger'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const vide = () => Object.fromEntries(PIECES.map((p) => [p.cle, 0]))
const pieces = ref(vide())
const piecesRestantes = computed(() => PIECES.filter((p) => props.butin.pieces[p.cle] > 0))
const demandeValide = computed(() => PIECES.some((p) => pieces.value[p.cle] > 0)
  && PIECES.every((p) => Number.isInteger(pieces.value[p.cle]) && pieces.value[p.cle] >= 0 && pieces.value[p.cle] <= props.butin.pieces[p.cle]))

const agir = (action) => envoyer(async () => {
  await action()
  emit('recharger')
})
const prendreObjet = (objet, quantite = 1) => agir(() => api.prendreObjet(props.campagneId, props.butin.id, objet.id, quantite))
const prendreMaPart = () => agir(() => api.prendreMaPart(props.campagneId, props.butin.id))

const decrire = (bourse) => PIECES.filter((p) => bourse?.[p.cle] > 0).map((p) => `${bourse[p.cle]} ${p.cle}`).join(', ')
const maPart = computed(() => decrire(props.butin.part?.montant))
const prendrePieces = () => agir(async () => {
  await api.prendrePieces(props.campagneId, props.butin.id, pieces.value)
  pieces.value = vide()
})
const heure = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <article class="butin papier epingle">
    <p class="petites-capitales surtitre">Butin ouvert par le MJ</p>
    <h2>{{ butin.titre }}</h2>

    <section v-if="piecesRestantes.length || butin.part?.prise" class="bloc pieces">
      <h3>Les pièces</h3>
      <p v-if="piecesRestantes.length" class="reste">Il reste : <strong v-for="p in piecesRestantes" :key="p.cle" class="tas">{{ butin.pieces[p.cle] }} {{ p.cle }}</strong></p>
      <p v-if="butin.part?.prise" class="servi" role="status">Ta part est dans ta bourse.</p>
      <template v-else-if="peutPrendre && maPart">
        <p class="ta-part">Ta part : <strong>{{ maPart }}</strong></p>
        <button type="button" class="prendre-part" :disabled="enCours" @click="prendreMaPart">Prendre ma part</button>
      </template>
      <p v-if="butin.part?.servis.length" class="servis">Déjà servis : {{ butin.part.servis.join(', ') }}</p>
      <details v-if="peutPrendre && piecesRestantes.length" class="autrement">
        <summary>Prendre un autre montant</summary>
        <form class="prise-pieces" @submit.prevent="prendrePieces">
          <label v-for="p in piecesRestantes" :key="p.cle" class="champ">{{ p.cle }}
            <input v-model.number="pieces[p.cle]" type="number" min="0" :max="butin.pieces[p.cle]">
          </label>
          <button type="submit" class="bouton" :disabled="enCours || !demandeValide">Mettre dans ma bourse</button>
        </form>
      </details>
    </section>

    <section v-if="butin.objets.length" class="bloc">
      <h3>Les objets</h3>
      <ul class="objets">
        <li v-for="o in butin.objets" :key="o.id" :class="{ epuise: o.quantite === 0 }">
          <div class="texte">
            <strong>{{ o.libelle }}</strong> <span class="quantite">× {{ o.quantite }}</span>
            <p v-if="o.description" class="description">{{ o.description }}</p>
            <RouterLink v-if="o.objet" :to="{ name: 'objet', params: { id: campagneId, ficheId: o.objet.id } }" class="fiche">Ce que vous en savez →</RouterLink>
          </div>
          <div v-if="peutPrendre && o.quantite > 0" class="prise">
            <button type="button" class="prendre" :disabled="enCours" :aria-label="`Prendre ${o.quantite > 1 ? 'un' : ''} ${o.libelle}`" @click="prendreObjet(o)">Prendre{{ o.quantite > 1 ? ' 1' : '' }}</button>
            <button v-if="o.quantite > 1" type="button" class="lien" :disabled="enCours" @click="prendreObjet(o, o.quantite)">Tout ({{ o.quantite }})</button>
          </div>
          <span v-else-if="o.quantite === 0" class="parti">Tout est pris</span>
        </li>
      </ul>
    </section>
    <p v-if="!piecesRestantes.length && butin.objets.every((o) => o.quantite === 0)" class="vide">Ce butin est vide : tout a été partagé.</p>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>

    <details v-if="butin.prises.length" class="journal">
      <summary>Qui a pris quoi ({{ butin.prises.length }})</summary>
      <ul>
        <li v-for="(p, i) in butin.prises" :key="i"><time :datetime="p.le">{{ heure(p.le) }}</time> — {{ p.texte }}</li>
      </ul>
    </details>
  </article>
</template>

<style scoped>
.butin { padding: 1.8rem 1.4rem 1.2rem; display: flex; flex-direction: column; gap: 0.9rem; }
h2 { font-size: 1.5rem; }
h3 { font-size: 1.1rem; color: var(--ruban); border-bottom: 1.5px solid var(--ruban); padding-bottom: 0.1rem; }
.bloc { display: flex; flex-direction: column; gap: 0.5rem; }
.reste { margin: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: baseline; }
.tas { font-family: var(--f-cote); padding: 0.05rem 0.45rem; border: 1px solid var(--laiton-sombre); border-radius: 999px; background: rgba(201, 162, 86, 0.18); }
.surtitre { margin: 0 0 -0.6rem; color: var(--encre-2); }
.ta-part { margin: 0; font-size: 1.15rem; }
.prendre-part {
  min-height: 48px; border-radius: 4px; border: 0; background: var(--ruban); color: #f6ecd4;
  font: inherit; font-size: 1.05rem; font-weight: 700; cursor: pointer;
}
.prendre-part:disabled { opacity: 0.5; cursor: not-allowed; }
.servi { margin: 0; padding: 0.7rem; border-radius: 4px; background: var(--vert); color: #f6ecd4; font-weight: 700; text-align: center; }
.servis { margin: 0; font-size: var(--t-s); color: var(--encre-2); }
.autrement summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-size: var(--t-s); color: var(--encre-2); }
.prendre {
  min-height: 44px; min-width: 6rem; padding: 0 0.9rem; border-radius: 22px; border: 1px solid var(--encre-2);
  background: transparent; color: var(--encre); font: inherit; font-weight: 700; cursor: pointer;
}
.lien { min-height: 44px; border: 0; background: none; color: var(--encre-2); font: inherit; font-size: var(--t-s); text-decoration: underline; cursor: pointer; }
.prise-pieces { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-end; }
.prise-pieces input { width: 4.5rem; }
.objets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.objets li { display: flex; justify-content: space-between; gap: 0.8rem; align-items: center; padding: 0.5rem 0; border-bottom: 1px dashed var(--papier-ombre); }
.epuise .texte { opacity: 0.55; }
.texte { min-width: 0; }
.quantite { font-family: var(--f-cote); color: var(--encre-2); }
.description { margin: 0.15rem 0 0; font-size: var(--t-s); font-style: italic; color: var(--encre-2); }
.fiche { font-size: var(--t-s); color: var(--ruban); }
.prise { display: flex; flex-direction: column; gap: 0.1rem; align-items: center; flex: none; }
.parti { font-size: var(--t-s); font-style: italic; color: var(--encre-2); flex: none; }
.vide { margin: 0; font-style: italic; color: var(--encre-2); }
.journal { font-size: var(--t-s); color: var(--encre-2); }
.journal ul { margin: 0.3rem 0 0; padding-left: 1.1rem; }
</style>
