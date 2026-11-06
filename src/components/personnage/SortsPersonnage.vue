<script setup>
import { computed, ref } from 'vue'
import { api } from '../../api/client.js'
import { CARACTERISTIQUES } from '../../domain/personnage.js'
import { utiliserEnvoi } from '../../composables/envoi.js'

/**
 * Sorts d'une fiche qui suit les règles : emplacements (à cocher en séance), puis pour chaque classe qui lance des sorts,
 * ses limites et sa sélection. La sélection se modifie ici ; le serveur vérifie qu'elle respecte les règles.
 */
const props = defineProps({
  campagneId: { type: String, required: true },
  personnage: { type: Object, required: true },
})
const emit = defineEmits(['recharger'])
const { enCours, erreur, envoyer } = utiliserEnvoi()

const RUBRIQUES = {
  toursDeMagie: 'Tours de magie', connus: 'Sorts connus', grimoire: 'Grimoire', prepares: 'Sorts préparés', arcanum: 'Arcanums mystiques',
}
const PAR_MODE = { connus: ['toursDeMagie', 'connus', 'arcanum'], prepares: ['toursDeMagie', 'prepares'], grimoire: ['toursDeMagie', 'grimoire', 'prepares'] }
const NOMS_CARACS = Object.fromEntries(CARACTERISTIQUES.map((c) => [c.cle, c.nom]))

const etats = computed(() => props.personnage.sorts ?? [])
const rubriquesDe = (etat) => PAR_MODE[etat.mode].filter((cle) => cle !== 'arcanum' || etat.limites.arcanum.length)
const limiteDe = (etat, cle) => ({ toursDeMagie: etat.limites.toursDeMagie, connus: etat.limites.connus, prepares: etat.limites.prepares,
  arcanum: etat.limites.arcanum.length, grimoire: null })[cle]

// --- Affichage d'un sort ---
const libelle = (etat, id) => {
  const s = etat.sorts[id]
  if (!s) return id
  return `${s.nom}${s.rituel ? ' (R)' : ''}${s.concentration ? ' (C)' : ''}`
}
const infobulle = (etat, id) => {
  const s = etat.sorts[id]
  return s ? `${s.niveau ? `Niveau ${s.niveau}` : 'Tour de magie'}, ${s.ecole} — ${s.source}${s.page ? `, p. ${s.page}` : ''}` : ''
}
/** Les sorts rangés par niveau : [[niveau, [ids]], …]. */
function parNiveau(etat, ids) {
  const groupes = new Map()
  for (const id of ids) {
    const n = etat.sorts[id]?.niveau ?? 0
    groupes.set(n, [...(groupes.get(n) ?? []), id])
  }
  return [...groupes].sort(([a], [b]) => a - b)
}
const titreNiveau = (n) => (n === 0 ? 'Tours' : `Niv. ${n}`)

// --- Modifier la sélection d'une classe ---
const edition = ref(null) // { classe, brouillon: { cle: [ids] } }
const filtre = ref('')
const etatEdite = computed(() => etats.value.find((e) => e.classe === edition.value?.classe) ?? null)

function modifier(etat) {
  filtre.value = ''
  edition.value = { classe: etat.classe, brouillon: Object.fromEntries(rubriquesDe(etat).map((cle) => [cle, [...etat.choisis[cle]]])) }
}

/** Ce qu'on peut cocher dans une rubrique ; les secrets magiques du barde s'ajoutent aux sorts connus. */
function optionsDe(etat, cle) {
  const brouillon = edition.value.brouillon
  const toutes = {
    toursDeMagie: etat.options.toursDeMagie,
    connus: [...etat.options.sorts, ...etat.options.secrets],
    grimoire: etat.options.sorts,
    prepares: etat.mode === 'grimoire' ? brouillon.grimoire : etat.options.prepares,
    arcanum: Object.values(etat.options.arcanum).flat(),
  }[cle]
  const recherche = filtre.value.trim().toLowerCase()
  return recherche ? toutes.filter((id) => (etat.sorts[id]?.nom ?? id).toLowerCase().includes(recherche) || brouillon[cle].includes(id)) : toutes
}

function basculer(cle, id) {
  const liste = edition.value.brouillon[cle]
  edition.value.brouillon[cle] = liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]
  // Un sort retiré du grimoire ne peut plus rester préparé.
  if (cle === 'grimoire' && edition.value.brouillon.prepares) {
    edition.value.brouillon.prepares = edition.value.brouillon.prepares.filter((x) => edition.value.brouillon.grimoire.includes(x))
  }
}

const enregistrer = () => envoyer(async () => {
  await api.choisirSorts(props.campagneId, props.personnage.id, edition.value.classe, edition.value.brouillon)
  edition.value = null
  emit('recharger')
})

// --- Emplacements dépensés ---
const emplacements = computed(() => props.personnage.regles?.emplacements ?? { sorts: [], pacte: null })
const utilises = computed(() => props.personnage.fiche.emplacementsUtilises ?? { sorts: [], pacte: 0 })
const aDesEmplacements = computed(() => emplacements.value.sorts.length > 0 || emplacements.value.pacte)

const ecrireEmplacements = (valeur) => envoyer(async () => {
  await api.modifierPersonnage(props.campagneId, props.personnage.id, { emplacementsUtilises: valeur })
  emit('recharger')
})
/** Cocher la 3e case coche les deux premières ; décocher la dernière cochée la libère. */
function depenser(niveau, rang) {
  const sorts = emplacements.value.sorts.map((_, i) => utilises.value.sorts[i] ?? 0)
  sorts[niveau] = sorts[niveau] === rang ? rang - 1 : rang
  return ecrireEmplacements({ ...utilises.value, sorts })
}
const depenserPacte = (rang) => ecrireEmplacements({ ...utilises.value, pacte: utilises.value.pacte === rang ? rang - 1 : rang })
const reposCourt = () => ecrireEmplacements({ ...utilises.value, pacte: 0 })
const reposLong = () => ecrireEmplacements({ sorts: [], pacte: 0 })
</script>

<template>
  <section v-if="etats.length" class="sorts papier" aria-labelledby="titre-sorts">
    <h2 id="titre-sorts">Sorts</h2>

    <div v-if="aDesEmplacements" class="bloc emplacements">
      <h3>Emplacements</h3>
      <div v-for="(total, i) in emplacements.sorts" :key="i" class="rangee">
        <span class="niveau">Niv. {{ i + 1 }}</span>
        <input v-for="r in total" :key="r" type="checkbox" :checked="(utilises.sorts[i] ?? 0) >= r" :disabled="enCours"
          :aria-label="`Emplacement de niveau ${i + 1}, n° ${r}, dépensé`" @change="depenser(i, r)">
      </div>
      <div v-if="emplacements.pacte" class="rangee">
        <span class="niveau">Pacte</span>
        <input v-for="r in emplacements.pacte.nombre" :key="r" type="checkbox" :checked="utilises.pacte >= r" :disabled="enCours"
          :aria-label="`Emplacement de pacte n° ${r}, dépensé`" @change="depenserPacte(r)">
        <small>niveau {{ emplacements.pacte.niveau }}</small>
      </div>
      <div class="repos">
        <button v-if="emplacements.pacte" type="button" class="lien-bouton" :disabled="enCours" @click="reposCourt">Repos court</button>
        <button type="button" class="lien-bouton" :disabled="enCours" @click="reposLong">Repos long</button>
      </div>
    </div>

    <article v-for="etat in etats" :key="etat.classe" class="classe">
      <header class="entete">
        <h3>{{ etat.nom }}</h3>
        <p class="carac">
          {{ NOMS_CARACS[etat.caracteristique] }} · DD {{ etat.dd }} · attaque {{ etat.attaque >= 0 ? '+' : '' }}{{ etat.attaque }}
          <template v-if="etat.niveauMax"> · jusqu’au niveau {{ etat.niveauMax }}</template>
        </p>
        <button v-if="edition?.classe !== etat.classe" type="button" class="lien-bouton" @click="modifier(etat)">Modifier</button>
      </header>

      <p v-if="etat.accordes.length" class="accordes">
        <strong>Toujours disponibles :</strong>
        <span v-for="(id, i) in etat.accordes" :key="id" :title="infobulle(etat, id)">{{ libelle(etat, id) }}{{ i < etat.accordes.length - 1 ? ', ' : '' }}</span>
      </p>

      <!-- Lecture -->
      <template v-if="edition?.classe !== etat.classe">
        <div v-for="cle in rubriquesDe(etat)" :key="cle" class="rubrique">
          <h4>
            {{ RUBRIQUES[cle] }}
            <small v-if="limiteDe(etat, cle) !== null">{{ etat.choisis[cle].length }} / {{ limiteDe(etat, cle) }}</small>
            <small v-else-if="cle === 'grimoire'">{{ etat.choisis.grimoire.length }} (au moins {{ etat.limites.grimoire }} attendus)</small>
          </h4>
          <p v-if="!etat.choisis[cle].length" class="vide">Rien de choisi pour l’instant.</p>
          <ul v-else class="liste">
            <li v-for="[n, ids] in parNiveau(etat, etat.choisis[cle])" :key="n">
              <span class="niveau">{{ titreNiveau(n) }}</span>
              <span v-for="(id, i) in ids" :key="id" :title="infobulle(etat, id)">{{ libelle(etat, id) }}{{ i < ids.length - 1 ? ', ' : '' }}</span>
            </li>
          </ul>
        </div>
      </template>

      <!-- Modification -->
      <form v-else class="edition" @submit.prevent="enregistrer">
        <label class="champ">Chercher un sort <input v-model="filtre" type="search" placeholder="ex. boule de feu"></label>
        <fieldset v-for="cle in rubriquesDe(etatEdite)" :key="cle" class="rubrique">
          <legend>
            {{ RUBRIQUES[cle] }}
            <small v-if="limiteDe(etatEdite, cle) !== null" :class="{ trop: edition.brouillon[cle].length > limiteDe(etatEdite, cle) }">
              {{ edition.brouillon[cle].length }} / {{ limiteDe(etatEdite, cle) }}
            </small>
          </legend>
          <p v-if="cle === 'connus' && etatEdite.limites.secrets" class="aide">
            Dont {{ etatEdite.limites.secrets }} secret(s) magique(s), pris dans n’importe quelle liste.
          </p>
          <div v-for="[n, ids] in parNiveau(etatEdite, optionsDe(etatEdite, cle))" :key="n" class="niveau-sorts">
            <span class="niveau">{{ titreNiveau(n) }}</span>
            <div class="options">
              <label v-for="id in ids" :key="id" class="option" :title="infobulle(etatEdite, id)">
                <input type="checkbox" :checked="edition.brouillon[cle].includes(id)" @change="basculer(cle, id)">
                {{ libelle(etatEdite, id) }}
              </label>
            </div>
          </div>
        </fieldset>
        <div class="actions">
          <button type="submit" class="bouton bouton--plein" :disabled="enCours">Enregistrer</button>
          <button type="button" class="lien-bouton" @click="edition = null">Annuler</button>
        </div>
      </form>
    </article>
    <p class="legende">(R) rituel · (C) concentration — survole un sort pour voir son école et sa page.</p>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
  </section>
</template>

<style scoped>
.sorts { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.9rem; }
.sorts h2 { margin: 0; }
.sorts h3 { margin: 0; font-size: 1.05rem; }
.sorts h4 { margin: 0.3rem 0 0.2rem; font-size: 0.98rem; }
.sorts small { font-weight: normal; color: #6b5640; }
.bloc, .classe { border: 1px solid rgba(90, 60, 30, 0.35); border-radius: 4px; padding: 0.6rem 0.8rem; }
.rangee { display: flex; align-items: center; gap: 0.35rem; }
.niveau { display: inline-block; min-width: 3.4rem; font-weight: bold; color: #7a5a3a; font-variant-numeric: tabular-nums; }
.repos { display: flex; gap: 1rem; margin-top: 0.4rem; }
.entete { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem 1rem; }
.carac { margin: 0; flex: 1; color: #5b4632; }
.accordes { margin: 0.4rem 0 0; }
.liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.vide { margin: 0; font-style: italic; color: #7a6450; }
.edition { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.5rem; }
.edition .rubrique { border: 1px solid rgba(90, 60, 30, 0.25); border-radius: 4px; padding: 0.4rem 0.6rem; }
.edition legend { font-weight: bold; padding: 0 0.3rem; }
.niveau-sorts { display: flex; gap: 0.5rem; align-items: baseline; padding: 0.15rem 0; }
.options { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0 0.8rem; flex: 1; }
.option { display: flex; gap: 0.35rem; align-items: baseline; font-size: 0.95rem; }
.trop { color: #8a3b2c; font-weight: bold; }
.aide { margin: 0 0 0.3rem; font-style: italic; font-size: 0.92rem; }
.actions { display: flex; gap: 0.8rem; align-items: center; }
.legende { margin: 0; font-size: 0.85rem; color: #6b5640; }
</style>
