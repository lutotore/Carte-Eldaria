<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../../api/client.js'
import { utiliserEnvoi } from '../../composables/envoi.js'

/**
 * Ce qu'on regarde à table, toujours visible en haut de la fiche : PV (dégâts et soins en un geste), CA, initiative,
 * vitesse, inspiration, jets contre la mort et emplacements de sorts. Les liens mènent aux trois pages de la feuille.
 */
const props = defineProps({
  campagneId: { type: String, required: true },
  personnage: { type: Object, required: true },
})
const emit = defineEmits(['recharger'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const fiche = computed(() => props.personnage.fiche)
const signe = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)
const montant = ref(1)
const reglages = ref(false)
watch(() => props.personnage.id, () => { reglages.value = false })

const ecrire = (champs) => envoyer(async () => {
  await api.modifierPersonnage(props.campagneId, props.personnage.id, champs)
  emit('recharger')
})

/** Les dégâts entament d'abord les PV temporaires ; les soins ne dépassent pas le maximum. */
function degats() {
  const n = Math.max(0, Number(montant.value) || 0)
  const temporaires = Math.max(0, fiche.value.pvTemporaires - n)
  const reste = Math.max(0, n - fiche.value.pvTemporaires)
  return ecrire({ pvTemporaires: temporaires, pvActuels: Math.max(0, fiche.value.pvActuels - reste) })
}
function soins() {
  const n = Math.max(0, Number(montant.value) || 0)
  const pvActuels = Math.min(fiche.value.pvMax, Math.max(0, fiche.value.pvActuels) + n)
  // Revenir au-dessus de 0 PV efface les jets contre la mort.
  return ecrire({ pvActuels, ...(pvActuels > 0 ? { jetsMort: { succes: 0, echecs: 0 } } : {}) })
}
function nombre(cle, evenement) {
  const valeur = Number(evenement.target.value)
  if (evenement.target.value === '' || !Number.isInteger(valeur)) {
    evenement.target.value = fiche.value[cle]
    return undefined
  }
  return ecrire({ [cle]: valeur })
}
const jetMort = (type, rang) => ecrire({ jetsMort: { ...fiche.value.jetsMort, [type]: fiche.value.jetsMort[type] === rang ? rang - 1 : rang } })

// --- Emplacements de sorts ---
const emplacements = computed(() => props.personnage.regles?.emplacements ?? { sorts: [], pacte: null })
const utilises = computed(() => fiche.value.emplacementsUtilises ?? { sorts: [], pacte: 0 })
const aDesEmplacements = computed(() => emplacements.value.sorts.length > 0 || Boolean(emplacements.value.pacte))
function depenser(niveau, rang) {
  const sorts = emplacements.value.sorts.map((_, i) => utilises.value.sorts[i] ?? 0)
  sorts[niveau] = sorts[niveau] === rang ? rang - 1 : rang
  return ecrire({ emplacementsUtilises: { ...utilises.value, sorts } })
}
const depenserPacte = (rang) => ecrire({ emplacementsUtilises: { ...utilises.value, pacte: utilises.value.pacte === rang ? rang - 1 : rang } })
const reposCourt = () => ecrire({ emplacementsUtilises: { ...utilises.value, pacte: 0 } })
const reposLong = () => ecrire({
  emplacementsUtilises: { sorts: [], pacte: 0 }, pvActuels: fiche.value.pvMax, jetsMort: { succes: 0, echecs: 0 },
})

const ratio = computed(() => (fiche.value.pvMax ? Math.max(0, Math.min(1, fiche.value.pvActuels / fiche.value.pvMax)) : 1))
const etatPv = computed(() => (fiche.value.pvActuels <= 0 ? 'a-terre' : ratio.value <= 0.5 ? 'blesse' : ''))
</script>

<template>
  <section class="barre" aria-label="Combat">
    <div class="pv" :class="etatPv">
      <div class="jauge" :style="{ '--ratio': ratio }" aria-hidden="true" />
      <p class="valeurs">
        <span class="libelle">PV</span>
        <strong>{{ fiche.pvActuels }}</strong><span class="sur">/ {{ fiche.pvMax }}</span>
        <span v-if="fiche.pvTemporaires" class="temp" title="PV temporaires">+{{ fiche.pvTemporaires }}</span>
      </p>
      <div class="actions-pv">
        <button type="button" class="pastille moins" :disabled="enCours" title="Dégâts (entament d’abord les PV temporaires)" @click="degats">−</button>
        <input v-model.number="montant" type="number" min="0" max="999" aria-label="Montant de dégâts ou de soins">
        <button type="button" class="pastille plus" :disabled="enCours" title="Soins (jusqu’au maximum)" @click="soins">+</button>
        <button type="button" class="lien-bouton reglage" :aria-expanded="reglages" @click="reglages = !reglages">⚙</button>
      </div>
      <div v-if="reglages" class="reglages">
        <label>Max <input type="number" min="0" :value="fiche.pvMax" @change="nombre('pvMax', $event)"></label>
        <label>Actuels <input type="number" :value="fiche.pvActuels" @change="nombre('pvActuels', $event)"></label>
        <label>Temporaires <input type="number" min="0" :value="fiche.pvTemporaires" @change="nombre('pvTemporaires', $event)"></label>
      </div>
    </div>

    <div class="chiffres">
      <label class="chiffre" title="Classe d’armure">
        <span>CA</span>
        <input type="number" min="0" max="50" :value="fiche.ca" @change="nombre('ca', $event)">
      </label>
      <p class="chiffre"><span>Init.</span><strong>{{ signe(personnage.calculs.initiative) }}</strong></p>
      <label class="chiffre large" title="Vitesse">
        <span>Vitesse</span>
        <input :value="fiche.vitesse" maxlength="60" @change="ecrire({ vitesse: $event.target.value })">
      </label>
      <label class="chiffre inspiration" :class="{ active: fiche.inspiration }" title="Inspiration">
        <span>Inspi.</span>
        <input type="checkbox" :checked="fiche.inspiration" @change="ecrire({ inspiration: $event.target.checked })">
      </label>
    </div>

    <fieldset class="mort" :class="{ urgent: fiche.pvActuels <= 0 }">
      <legend>Contre la mort</legend>
      <span title="Succès">✓
        <input v-for="r in 3" :key="`s${r}`" type="checkbox" :checked="fiche.jetsMort.succes >= r" :aria-label="`Succès ${r}`" @change="jetMort('succes', r)">
      </span>
      <span title="Échecs">✗
        <input v-for="r in 3" :key="`e${r}`" type="checkbox" class="echec" :checked="fiche.jetsMort.echecs >= r" :aria-label="`Échec ${r}`" @change="jetMort('echecs', r)">
      </span>
    </fieldset>

    <div v-if="aDesEmplacements" class="emplacements">
      <span v-for="(total, i) in emplacements.sorts" :key="i" class="niveau" :title="`Emplacements de niveau ${i + 1}`">
        <small>{{ i + 1 }}</small>
        <input v-for="r in total" :key="r" type="checkbox" :checked="(utilises.sorts[i] ?? 0) >= r" :disabled="enCours"
          :aria-label="`Emplacement de niveau ${i + 1}, n° ${r}, dépensé`" @change="depenser(i, r)">
      </span>
      <span v-if="emplacements.pacte" class="niveau pacte" :title="`Magie de pacte, niveau ${emplacements.pacte.niveau}`">
        <small>P{{ emplacements.pacte.niveau }}</small>
        <input v-for="r in emplacements.pacte.nombre" :key="r" type="checkbox" :checked="utilises.pacte >= r" :disabled="enCours"
          :aria-label="`Emplacement de pacte n° ${r}, dépensé`" @change="depenserPacte(r)">
      </span>
    </div>

    <div class="repos">
      <button v-if="emplacements.pacte" type="button" class="lien-bouton" :disabled="enCours" @click="reposCourt">Repos court</button>
      <button type="button" class="lien-bouton" :disabled="enCours" title="PV au maximum, emplacements récupérés" @click="reposLong">Repos long</button>
    </div>

    <nav class="pages" aria-label="Pages de la fiche">
      <a href="#feuille">Feuille</a>
      <a href="#aptitudes">Aptitudes</a>
      <a v-if="personnage.sorts?.length" href="#sorts">Sorts</a>
      <a href="#equipement">Équipement</a>
    </nav>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
  </section>
</template>

<style scoped>
.barre {
  position: sticky; top: 0; z-index: 20;
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem;
  padding: 0.5rem 0.9rem; border-radius: 6px;
  background: linear-gradient(180deg, var(--cuir-2), var(--cuir)); color: var(--papier);
  border: 1px solid var(--couture); box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
}
.pv { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.6rem; padding: 0.2rem 0.6rem 0.35rem; border-radius: 5px; background: rgba(0, 0, 0, 0.25); min-width: 15rem; }
.jauge { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; border-radius: 0 0 5px 5px; background: linear-gradient(90deg, var(--lavis-vert) calc(var(--ratio) * 100%), rgba(255, 255, 255, 0.1) 0); }
.pv.blesse .jauge { background: linear-gradient(90deg, var(--ocre-alerte) calc(var(--ratio) * 100%), rgba(255, 255, 255, 0.1) 0); }
.pv.a-terre { box-shadow: inset 0 0 0 1px #d0675a; }
.valeurs { margin: 0; display: flex; align-items: baseline; gap: 0.3rem; }
.libelle { font-size: var(--t-xs); letter-spacing: 0.08em; color: var(--laiton-clair); }
.valeurs strong { font-family: var(--f-titre); font-size: 1.7rem; line-height: 1; }
.sur { color: var(--papier-ombre); }
.temp { font-family: var(--f-cote); font-size: var(--t-s); color: var(--cristal-clair); }
.actions-pv { display: flex; align-items: center; gap: 0.25rem; }
.actions-pv input { width: 3.4rem; text-align: center; border-radius: 4px; border: 1px solid var(--couture); background: var(--papier); color: var(--encre); padding: 0.2rem; }
.pastille { width: 2.1rem; height: 2.1rem; border-radius: 50%; border: 1px solid var(--couture); font-size: 1.2rem; font-weight: bold; cursor: pointer; color: #f6e7cf; }
.pastille.moins { background: var(--rouge); }
.pastille.plus { background: var(--vert); }
.reglage { color: var(--laiton-clair); font-size: 1.1rem; }
.reglages { flex-basis: 100%; display: flex; gap: 0.5rem; }
.reglages label { display: flex; flex-direction: column; font-size: var(--t-xs); color: var(--laiton-clair); }
.reglages input { width: 4.2rem; border-radius: 4px; border: 1px solid var(--couture); background: var(--papier); color: var(--encre); padding: 0.15rem 0.3rem; }
.chiffres { display: flex; gap: 0.4rem; }
.chiffre { margin: 0; display: flex; flex-direction: column; align-items: center; min-width: 3.2rem; padding: 0.15rem 0.35rem; border-radius: 5px; border: 1px solid var(--couture); background: rgba(240, 223, 182, 0.08); }
.chiffre span { font-size: var(--t-xs); color: var(--laiton-clair); letter-spacing: 0.05em; }
.chiffre strong, .chiffre input { font-family: var(--f-titre); font-size: 1.25rem; line-height: 1.2; text-align: center; color: var(--papier); background: transparent; border: 0; width: 2.8rem; padding: 0; }
.chiffre.large input { width: 4.2rem; font-size: 1rem; }
.chiffre.inspiration input { width: 1.2rem; height: 1.2rem; margin: 0.2rem; accent-color: var(--laiton); }
.chiffre.inspiration.active { border-color: var(--laiton-clair); box-shadow: 0 0 8px rgba(230, 201, 131, 0.5); }
.mort { margin: 0; padding: 0.1rem 0.5rem 0.25rem; border: 1px solid var(--couture); border-radius: 5px; display: flex; gap: 0.6rem; font-size: var(--t-s); }
.mort legend { font-size: var(--t-xs); color: var(--laiton-clair); padding: 0 0.2rem; }
.mort.urgent { border-color: #d0675a; background: rgba(150, 44, 34, 0.25); }
.mort input { accent-color: var(--lavis-vert); }
.mort input.echec { accent-color: var(--rouge); }
.emplacements { display: flex; flex-wrap: wrap; gap: 0.2rem 0.7rem; }
.niveau { display: inline-flex; align-items: center; gap: 0.1rem; }
.niveau small { font-family: var(--f-cote); color: var(--laiton-clair); margin-right: 0.15rem; }
.niveau input { accent-color: var(--brume); margin: 0; }
.niveau.pacte input { accent-color: var(--cristal); }
.repos { display: flex; gap: 0.7rem; }
.repos .lien-bouton, .pages a { color: var(--laiton-clair); font-size: var(--t-s); }
.pages { margin-left: auto; display: flex; gap: 0.8rem; }
.pages a { text-decoration: none; border-bottom: 1px dotted var(--couture); }
.pages a:hover { color: var(--papier); }
.message { flex-basis: 100%; margin: 0; }
@media (max-width: 700px) {
  .barre { padding: 0.35rem 0.45rem; gap: 0.3rem 0.5rem; }
  .pv { min-width: 0; flex: 1 1 100%; justify-content: space-between; padding: 0.1rem 0.4rem 0.3rem; }
  .valeurs strong { font-size: 1.45rem; }
  .pastille { width: 1.9rem; height: 1.9rem; }
  .chiffres { flex: 1 1 100%; gap: 0.3rem; }
  .chiffre { flex: 1 1 0; min-width: 0; padding: 0.05rem 0.2rem; }
  .chiffre strong, .chiffre input { font-size: 1.05rem; }
  .chiffre.large input { width: 100%; font-size: 0.95rem; }
  .mort { position: relative; padding: 0.15rem 0.4rem; gap: 0.4rem; }
  .mort legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .repos, .pages { gap: 0.6rem; }
  .pages { margin-left: auto; }
  .repos .lien-bouton, .pages a { font-size: var(--t-xs); }
}
</style>
