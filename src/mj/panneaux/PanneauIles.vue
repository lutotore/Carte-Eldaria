<script setup>
import { computed } from 'vue'
import { annulerChute, faireTomber, modifierIle } from '../../domain/index.js'
import { formaterAltitude, NOMS_STATUT_ILE } from '../../composables/format.js'

const props = defineProps({ etat: { type: Object, required: true } })
const emit = defineEmits(['agir'])

const iles = computed(() => Object.entries(props.etat.iles).sort((a, b) => a[1].nom.localeCompare(b[1].nom, 'fr')))
const modifier = (id, champ, valeur) => emit('agir', (e) => modifierIle(e, id, champ, valeur))
</script>

<template>
  <div class="panneau">
    <p class="aide">Une île perd « m par point » à chaque point d'Horloge au-delà de {{ etat.regles.horloge.depart }} et tombe d'elle-même en touchant la brume. « Faire tomber » sert aux chutes scénarisées. Seules les îles révélées apparaissent sur la carte des joueurs ; « mesurée » décide s'ils connaissent son altitude.</p>
    <div class="tableau">
      <table>
        <thead>
          <tr><th scope="col">Île</th><th scope="col">Révélée</th><th scope="col">Mesurée</th><th scope="col">Altitude</th><th scope="col">m par point</th><th scope="col">État</th><th scope="col">Note du MJ</th><th scope="col"><span class="visuellement-cache">Actions</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="[id, ile] in iles" :key="id">
            <th scope="row" class="nom">{{ ile.nom }}</th>
            <td><input type="checkbox" :checked="ile.revelee" :aria-label="`Révéler ${ile.nom}`" @change="modifier(id, 'revelee', $event.target.checked)"></td>
            <td><input type="checkbox" :checked="ile.mesuree" :aria-label="`Altitude de ${ile.nom} connue des joueurs`" @change="modifier(id, 'mesuree', $event.target.checked)"></td>
            <td class="cote">{{ ile.statut === 'tombee' ? '—' : formaterAltitude(ile.alt) }}</td>
            <td><input type="text" class="cote vitesse" :value="ile.vitesse" :aria-label="`Vitesse de descente de ${ile.nom}`" @change="modifier(id, 'vitesse', $event.target.value)"></td>
            <td><span class="tampon" :class="`tampon--${ile.statut}`">{{ NOMS_STATUT_ILE[ile.statut] }}</span></td>
            <td><input type="text" :value="ile.notesMJ ?? ''" :aria-label="`Note sur ${ile.nom}`" @change="modifier(id, 'notesMJ', $event.target.value)"></td>
            <td>
              <button v-if="ile.statut === 'tombee'" type="button" class="bouton" @click="emit('agir', (e) => annulerChute(e, id))">Annuler la chute</button>
              <button v-else type="button" class="bouton bouton--rouge" @click="emit('agir', (e) => faireTomber(e, id))">Faire tomber</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.nom { font-family: var(--f-titre); font-weight: 400; text-align: left; white-space: nowrap; border-bottom: 1px dotted var(--trait); padding: 0.35rem 0.5rem; }
.vitesse { width: 4.5rem; }
td input[type='text']:not(.vitesse) { width: 100%; min-width: 10rem; }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
