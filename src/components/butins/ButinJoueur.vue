<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'
import { PIECES } from '../../domain/personnage.js'

/** Un butin ouvert, côté joueur : chacun prend ce qu'il veut, objet par objet ou en pièces. */
const props = defineProps({
  campagneId: { type: String, required: true },
  butin: { type: Object, required: true },
  peutPrendre: { type: Boolean, default: false },
})
const emit = defineEmits(['recharger'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const vide = () => Object.fromEntries(PIECES.map((p) => [p.cle, 0]))
const pieces = ref(vide())
const quantites = ref({})
const piecesRestantes = computed(() => PIECES.filter((p) => props.butin.pieces[p.cle] > 0))
const demandeValide = computed(() => PIECES.some((p) => pieces.value[p.cle] > 0)
  && PIECES.every((p) => Number.isInteger(pieces.value[p.cle]) && pieces.value[p.cle] >= 0 && pieces.value[p.cle] <= props.butin.pieces[p.cle]))

const agir = (action) => envoyer(async () => {
  await action()
  emit('recharger')
})
const quantiteChoisie = (objet) => Math.min(quantites.value[objet.id] ?? 1, objet.quantite)
const prendreObjet = (objet) => agir(async () => {
  await api.prendreObjet(props.campagneId, props.butin.id, objet.id, quantiteChoisie(objet))
  delete quantites.value[objet.id]
})
const prendrePieces = () => agir(async () => {
  await api.prendrePieces(props.campagneId, props.butin.id, pieces.value)
  pieces.value = vide()
})
const heure = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <article class="butin papier epingle">
    <h2>{{ butin.titre }}</h2>

    <section v-if="piecesRestantes.length" class="bloc">
      <h3>Pièces</h3>
      <p class="reste">Il reste : <strong v-for="p in piecesRestantes" :key="p.cle" class="tas">{{ butin.pieces[p.cle] }} {{ p.cle }}</strong></p>
      <form v-if="peutPrendre" class="prise-pieces" @submit.prevent="prendrePieces">
        <label v-for="p in piecesRestantes" :key="p.cle" class="champ">{{ p.cle }}
          <input v-model.number="pieces[p.cle]" type="number" min="0" :max="butin.pieces[p.cle]">
        </label>
        <button type="submit" class="bouton bouton--plein" :disabled="enCours || !demandeValide">Mettre dans ma bourse</button>
      </form>
    </section>

    <section v-if="butin.objets.length" class="bloc">
      <h3>Objets</h3>
      <ul class="objets">
        <li v-for="o in butin.objets" :key="o.id" :class="{ epuise: o.quantite === 0 }">
          <div class="texte">
            <strong>{{ o.libelle }}</strong> <span class="quantite">× {{ o.quantite }}</span>
            <p v-if="o.description" class="description">{{ o.description }}</p>
            <RouterLink v-if="o.objet" :to="{ name: 'objet', params: { id: campagneId, ficheId: o.objet.id } }" class="fiche">Ce que vous en savez →</RouterLink>
          </div>
          <form v-if="peutPrendre && o.quantite > 0" class="prise" @submit.prevent="prendreObjet(o)">
            <select v-if="o.quantite > 1" :value="quantiteChoisie(o)" :aria-label="`Combien de ${o.libelle}`" @change="quantites[o.id] = Number($event.target.value)">
              <option v-for="n in o.quantite" :key="n" :value="n">{{ n }}</option>
            </select>
            <button type="submit" class="bouton" :disabled="enCours">Prendre</button>
          </form>
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
.prise-pieces { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-end; }
.prise-pieces input { width: 4.5rem; }
.objets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.objets li { display: flex; justify-content: space-between; gap: 0.8rem; align-items: flex-start; padding: 0.5rem 0; border-bottom: 1px dashed var(--papier-ombre); }
.epuise .texte { opacity: 0.55; }
.texte { min-width: 0; }
.quantite { font-family: var(--f-cote); color: var(--encre-2); }
.description { margin: 0.15rem 0 0; font-size: var(--t-s); font-style: italic; color: var(--encre-2); }
.fiche { font-size: var(--t-s); color: var(--ruban); }
.prise { display: flex; gap: 0.4rem; align-items: center; flex: none; }
.prise select { border: 1px solid var(--papier-ombre); border-radius: 3px; background: #f6ecd4; color: var(--encre); padding: 0.2rem; }
.parti { font-size: var(--t-s); font-style: italic; color: var(--encre-2); flex: none; }
.vide { margin: 0; font-style: italic; color: var(--encre-2); }
.journal { font-size: var(--t-s); color: var(--encre-2); }
.journal ul { margin: 0.3rem 0 0; padding-left: 1.1rem; }
</style>
