<script setup>
import { ref } from 'vue'
import { heureLisible, jourLisible } from '../../domain/agenda.js'
import { enHeure } from '../../domain/planning.js'

const props = defineProps({
  sondage: { type: Object, required: true },
  estMj: { type: Boolean, default: false },
  enCours: { type: Boolean, default: false },
})
const emit = defineEmits(['fixer', 'annuler'])

const plage = (debut, fin) => `${heureLisible(debut)} – ${heureLisible(fin)}${fin >= 1440 ? ' (+1 j)' : ''}`
const reponseDe = (date, joueurId) => date.reponses.find((r) => r.utilisateurId === joueurId)

/** Date en cours de fixation par le MJ, avec l'horaire pré-rempli d'après le créneau commun. */
const aFixer = ref(null)
function preparer(date) {
  aFixer.value = {
    dateId: date.id,
    debut: date.creneau ? enHeure(date.creneau.debut) : '14:00',
    fin: date.creneau ? enHeure(date.creneau.fin) : '23:00',
    lieu: props.sondage.lieu,
  }
}
const confirmerAnnulation = ref(false)
</script>

<template>
  <section class="synthese papier" aria-labelledby="titre-synthese">
    <h2 id="titre-synthese">Réponses</h2>
    <p v-if="sondage.lieu" class="chapeau">Lieu prévu : {{ sondage.lieu }}</p>

    <div class="tableau">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th v-for="j in sondage.joueurs" :key="j.id" scope="col">{{ j.identifiant }}</th>
            <th scope="col">Créneau commun</th>
            <th v-if="estMj" scope="col"><span class="visuellement-cache">Action</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="date in sondage.dates" :key="date.id">
            <tr :class="{ meilleure: date.id === sondage.meilleureDateId }">
              <th scope="row">
                {{ jourLisible(date.jour) }}
                <span v-if="date.id === sondage.meilleureDateId" class="tampon tampon--stable">Meilleure date</span>
              </th>
              <td v-for="j in sondage.joueurs" :key="j.id" :class="['case', reponseDe(date, j.id) ? (reponseDe(date, j.id).disponible ? 'oui' : 'non') : 'attente']">
                <template v-if="reponseDe(date, j.id)?.disponible">✓ <small>{{ plage(reponseDe(date, j.id).debut, reponseDe(date, j.id).fin) }}</small></template>
                <template v-else-if="reponseDe(date, j.id)">✗</template>
                <template v-else><span title="Pas encore répondu">…</span></template>
              </td>
              <td class="creneau">
                <template v-if="date.creneau">{{ plage(date.creneau.debut, date.creneau.fin) }} <small>({{ date.disponibles }}/{{ sondage.joueurs.length }})</small></template>
                <template v-else-if="date.disponibles">Pas d'horaire commun</template>
                <template v-else>—</template>
              </td>
              <td v-if="estMj"><button type="button" class="bouton" @click="preparer(date)">Fixer…</button></td>
            </tr>
            <tr v-if="estMj && aFixer?.dateId === date.id" class="fixer">
              <td :colspan="sondage.joueurs.length + 3">
                <form @submit.prevent="emit('fixer', aFixer)">
                  <span>Séance du {{ jourLisible(date.jour) }}</span>
                  <label class="champ">De <input v-model="aFixer.debut" type="time" step="900" required></label>
                  <label class="champ">à <input v-model="aFixer.fin" type="time" step="900" required></label>
                  <label class="champ">Lieu <input v-model="aFixer.lieu" type="text" maxlength="120"></label>
                  <button type="submit" class="bouton bouton--plein" :disabled="enCours">Fixer et prévenir tout le monde</button>
                  <button type="button" class="lien-bouton" @click="aFixer = null">Annuler</button>
                </form>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="estMj" class="bas">
      <button v-if="!confirmerAnnulation" type="button" class="lien-bouton annuler" @click="confirmerAnnulation = true">Annuler le sondage…</button>
      <span v-else class="confirmer">
        <button type="button" class="bouton bouton--rouge" :disabled="enCours" @click="emit('annuler')">Oui, annuler le sondage</button>
        <button type="button" class="lien-bouton" @click="confirmerAnnulation = false">Non</button>
      </span>
    </div>
  </section>
</template>

<style scoped>
.synthese { padding: 1.6rem 1.4rem 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; }
h2 { font-size: 1.6rem; color: var(--encre); }
.chapeau { margin: 0; }
.tableau { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
th, td { padding: 0.45rem 0.55rem; border-bottom: 1px solid rgba(45, 31, 21, 0.18); text-align: left; vertical-align: middle; }
thead th { font-weight: 400; font-style: italic; color: var(--encre-2); border-bottom: 1.5px solid var(--encre); white-space: nowrap; }
tbody th { font-weight: 400; font-family: var(--f-titre); font-size: 1.05rem; min-width: 11rem; }
tbody th .tampon { margin-left: 0.4rem; font-family: var(--f-texte); }
.meilleure { background: rgba(60, 94, 56, 0.1); }
.case { white-space: nowrap; }
.case small, .creneau small { color: var(--encre-2); }
.oui { color: var(--vert); font-weight: 700; }
.oui small { font-weight: 400; }
.non { color: var(--rouge); }
.attente { color: var(--encre-2); }
.creneau { white-space: nowrap; }
.fixer td { background: rgba(154, 87, 23, 0.08); }
.fixer form { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; align-items: center; }
.fixer .champ { flex-direction: row; align-items: center; gap: 0.35rem; }
.fixer input { border: 1px solid var(--papier-ombre); border-radius: 3px; background: #f6ecd4; padding: 0.3rem 0.45rem; color: var(--encre); }
.bas { display: flex; justify-content: flex-end; }
.annuler { color: var(--rouge); }
.confirmer { display: inline-flex; gap: 0.5rem; align-items: center; }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
