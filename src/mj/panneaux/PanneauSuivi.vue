<script setup>
import { ajouterPj, ajusterMarques, ajusterReputation, renommerPj, retirerPj } from '../../domain/index.js'

defineProps({ etat: { type: Object, required: true } })
const emit = defineEmits(['agir'])
const signe = (v) => (v > 0 ? `+${v}` : String(v))
</script>

<template>
  <div class="panneau deux-colonnes">
    <div>
      <h3>Réputation des factions</h3>
      <div class="tableau">
        <table>
          <thead><tr><th scope="col">Faction</th><th scope="col">Réputation (−3 à +3)</th></tr></thead>
          <tbody>
            <tr v-for="f in etat.regles.factions" :key="f.cle">
              <td>{{ f.nom }}</td>
              <td>
                <span class="pas">
                  <button type="button" :aria-label="`Baisser ${f.nom}`" @click="emit('agir', (e) => ajusterReputation(e, f.cle, -1))">−</button>
                  <span class="cote score" :class="{ pos: etat.reputations[f.cle] > 0, neg: etat.reputations[f.cle] < 0 }">{{ signe(etat.reputations[f.cle]) }}</span>
                  <button type="button" :aria-label="`Monter ${f.nom}`" @click="emit('agir', (e) => ajusterReputation(e, f.cle, 1))">+</button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div>
      <h3>Marques du Rêve</h3>
      <div class="tableau">
        <table>
          <thead><tr><th scope="col">Personnage</th><th scope="col">Marques</th><th scope="col"><span class="visuellement-cache">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="(pj, i) in etat.pjs" :key="i">
              <td><input type="text" :value="pj.nom" aria-label="Nom du personnage" @change="emit('agir', (e) => renommerPj(e, i, $event.target.value))"></td>
              <td>
                <span class="pas">
                  <button type="button" aria-label="Retirer une Marque" @click="emit('agir', (e) => ajusterMarques(e, i, -1))">−</button>
                  <span class="cote score">{{ pj.marques }}/5</span>
                  <button type="button" aria-label="Ajouter une Marque" @click="emit('agir', (e) => ajusterMarques(e, i, 1))">+</button>
                </span>
                <span v-if="pj.marques >= 5" class="tampon tampon--instable">Rêvé</span>
              </td>
              <td><button type="button" class="bouton bouton--rouge" @click="emit('agir', (e) => retirerPj(e, i))">Retirer</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p><button type="button" class="bouton" @click="emit('agir', (e) => ajouterPj(e))">Ajouter un personnage</button></p>
    </div>
  </div>
</template>

<style scoped>
h3 { font-size: 1.2rem; margin-bottom: 0.5rem; }
.score { min-width: 2.2rem; text-align: center; }
.pos { color: var(--vert); }
.neg { color: var(--rouge); }
.tampon { margin-left: 0.5rem; }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
