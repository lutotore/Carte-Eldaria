<script setup>
import { computed } from 'vue'
import { changerStatutMission, STATUTS_MISSION } from '../../domain/index.js'
import { NOMS_ACTE, NOMS_STATUT_MISSION } from '../../composables/format.js'

const props = defineProps({ etat: { type: Object, required: true } })
const emit = defineEmits(['agir'])

const missions = computed(() =>
  Object.entries(props.etat.missions).sort((a, b) => a[1].acte - b[1].acte || a[1].titre.localeCompare(b[1].titre, 'fr')),
)
const nomIle = (id) => props.etat.iles[id]?.nom ?? (id === 'infronde' ? "L'Infronde" : id)
</script>

<template>
  <div class="panneau">
    <p class="aide">Passer un ordre à « Ouverte » le montre aux joueurs. Accomplir une expédition ajoute +1 à l'Horloge, une seule fois.</p>
    <div class="tableau">
      <table>
        <thead><tr><th scope="col">Acte</th><th scope="col">Mission</th><th scope="col">Île</th><th scope="col">Type</th><th scope="col">État</th></tr></thead>
        <tbody>
          <tr v-for="[id, m] in missions" :key="id">
            <td class="cote">{{ NOMS_ACTE[m.acte - 1] }}</td>
            <td><strong>{{ m.titre }}</strong><div v-if="m.notesMJ" class="aide">{{ m.notesMJ }}</div></td>
            <td>{{ nomIle(m.ile) }}</td>
            <td>{{ m.type === 'expedition' ? 'Expédition' : 'Principale' }}</td>
            <td>
              <select :value="m.statut" :aria-label="`État de ${m.titre}`" @change="emit('agir', (e) => changerStatutMission(e, id, $event.target.value))">
                <option v-for="s in STATUTS_MISSION" :key="s" :value="s">{{ NOMS_STATUT_MISSION[s] }}</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
