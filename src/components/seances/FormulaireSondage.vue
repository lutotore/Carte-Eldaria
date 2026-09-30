<script setup>
import { computed, ref } from 'vue'
import { MAX_DATES } from '../../domain/planning.js'

defineProps({ enCours: { type: Boolean, default: false } })
const emit = defineEmits(['ouvrir'])

const dates = ref([''])
const lieu = ref('')
const dateLimite = ref('')
const aujourdHui = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

const remplies = computed(() => dates.value.filter(Boolean))
const ajouter = () => { if (dates.value.length < MAX_DATES) dates.value.push('') }
const retirer = (index) => { dates.value.splice(index, 1); if (!dates.value.length) dates.value.push('') }

function envoyer() {
  emit('ouvrir', { dates: [...new Set(remplies.value)], lieu: lieu.value, dateLimite: dateLimite.value || null })
}
</script>

<template>
  <form class="formulaire papier epingle" @submit.prevent="envoyer">
    <h2>Proposer des dates</h2>
    <p class="chapeau">Les joueurs seront prévenus et indiqueront pour chaque date s'ils sont disponibles, et de quelle heure à quelle heure.</p>

    <fieldset class="dates">
      <legend>Dates proposées ({{ remplies.length }} / {{ MAX_DATES }})</legend>
      <div v-for="(jour, i) in dates" :key="i" class="date">
        <input v-model="dates[i]" type="date" :min="aujourdHui" :aria-label="`Date ${i + 1}`">
        <button v-if="dates.length > 1" type="button" class="lien-bouton" :aria-label="`Retirer la date ${i + 1}`" @click="retirer(i)">Retirer</button>
      </div>
      <button v-if="dates.length < MAX_DATES" type="button" class="bouton" @click="ajouter">Ajouter une date</button>
    </fieldset>

    <label class="champ">Lieu (facultatif)
      <input v-model="lieu" type="text" maxlength="120" placeholder="Chez Tom, en ligne…">
      <span class="aide">Visible de tous les membres, et transmis à Google par ceux qui ajoutent la séance à Google Agenda : évite une adresse complète.</span>
    </label>

    <label class="champ">Répondre avant le (facultatif, inclus)
      <input v-model="dateLimite" type="date" :min="aujourdHui">
    </label>

    <div class="actions">
      <button type="submit" class="bouton bouton--plein" :disabled="enCours || !remplies.length">Ouvrir le sondage</button>
    </div>
  </form>
</template>

<style scoped>
.formulaire { padding: 2rem 1.6rem 1.4rem; display: flex; flex-direction: column; gap: 1rem; }
h2 { font-size: 1.6rem; color: var(--encre); }
.chapeau { margin: 0; }
.dates { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
.dates legend { font-size: var(--t-s); color: var(--encre-2); margin-bottom: 0.4rem; }
.date { display: flex; gap: 0.8rem; align-items: center; }
.date input, .champ input { border: 1px solid var(--papier-ombre); border-radius: 3px; background: #f6ecd4; padding: 0.45rem 0.6rem; color: var(--encre); }
.aide { font-style: italic; }
.actions { display: flex; gap: 0.6rem; }
</style>
