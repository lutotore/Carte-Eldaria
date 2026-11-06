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

// --- Emplacements (on les dépense dans la barre de combat) ---
const emplacements = computed(() => props.personnage.regles?.emplacements ?? { sorts: [], pacte: null })
const utilises = computed(() => props.personnage.fiche.emplacementsUtilises ?? { sorts: [], pacte: 0 })
function emplacementsDuNiveau(etat, n) {
  if (n === 0) return null
  if (etat.pacte && emplacements.value.pacte) {
    const { nombre, niveau } = emplacements.value.pacte
    return n === niveau ? { total: nombre, restants: nombre - utilises.value.pacte, pacte: true } : null
  }
  const total = emplacements.value.sorts[n - 1] ?? 0
  return total ? { total, restants: total - (utilises.value.sorts[n - 1] ?? 0) } : null
}

/** La page de sorts d'une classe : un cadre par niveau, des tours de magie au niveau maximal, avec ce qui y est choisi. */
function cadres(etat) {
  const affiches = new Set([...etat.accordes, ...etat.choisis.toursDeMagie, ...etat.choisis.connus, ...etat.choisis.grimoire,
    ...etat.choisis.prepares, ...etat.choisis.arcanum])
  const niveaux = [...Array(etat.niveauMax + 1).keys(), ...etat.limites.arcanum]
  return niveaux.map((n) => ({
    niveau: n,
    emplacements: emplacementsDuNiveau(etat, n),
    sorts: [...affiches].filter((id) => (etat.sorts[id]?.niveau ?? 0) === n).map((id) => ({
      id,
      toujours: etat.accordes.includes(id),
      prepare: etat.mode === 'grimoire' ? etat.choisis.prepares.includes(id) : null,
    })),
  }))
}
const resume = (etat) => rubriquesDe(etat).map((cle) => {
  const limite = limiteDe(etat, cle)
  return `${RUBRIQUES[cle]} ${etat.choisis[cle].length}${limite !== null ? ` / ${limite}` : ''}`
}).join(' · ')
</script>

<template>
  <section v-if="etats.length" class="sorts papier" aria-label="Sorts">

    <article v-for="etat in etats" :key="etat.classe" class="classe">
      <header class="entete">
        <div class="bandeau">
          <p><span>Classe</span><strong>{{ etat.nom }}</strong></p>
          <p><span>Caractéristique</span><strong>{{ NOMS_CARACS[etat.caracteristique] }}</strong></p>
          <p><span>DD des sorts</span><strong>{{ etat.dd }}</strong></p>
          <p><span>Attaque</span><strong>{{ etat.attaque >= 0 ? '+' : '' }}{{ etat.attaque }}</strong></p>
        </div>
        <p class="compteurs">
          {{ resume(etat) }}
          <button v-if="edition?.classe !== etat.classe" type="button" class="bouton" @click="modifier(etat)">Choisir mes sorts</button>
        </p>
      </header>

      <!-- Lecture : un cadre par niveau de sort -->
      <div v-if="edition?.classe !== etat.classe" class="cadres">
        <div v-for="cadre in cadres(etat)" :key="cadre.niveau" class="cadre" :class="{ tours: cadre.niveau === 0 }">
          <div class="tete">
            <span class="num">{{ cadre.niveau }}</span>
            <span class="intitule">{{ cadre.niveau === 0 ? 'Tours de magie' : `Niveau ${cadre.niveau}` }}</span>
            <span v-if="cadre.emplacements" class="emplacements" :title="cadre.emplacements.pacte ? 'Magie de pacte' : 'Emplacements restants'">
              {{ cadre.emplacements.restants }}/{{ cadre.emplacements.total }}
            </span>
          </div>
          <ul v-if="cadre.sorts.length">
            <li v-for="s in cadre.sorts" :key="s.id" :title="infobulle(etat, s.id)" :class="{ toujours: s.toujours, 'non-prepare': s.prepare === false }">
              <span class="puce">{{ s.toujours ? '◆' : s.prepare === false ? '○' : '●' }}</span>{{ libelle(etat, s.id) }}
            </li>
          </ul>
          <p v-else class="vide">—</p>
        </div>
      </div>

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
    <p class="legende">◆ toujours préparé · ● préparé ou connu · ○ dans le grimoire, non préparé · (R) rituel · (C) concentration — survole un sort pour voir son école et sa page.</p>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
  </section>
</template>

<style scoped>
.sorts { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 1rem; }
.sorts h2 { margin: 0; }
.sorts small { font-weight: normal; color: var(--encre-2); }
.classe { display: flex; flex-direction: column; gap: 0.6rem; }
.bandeau { display: grid; grid-template-columns: 2fr repeat(3, 1fr); gap: 0.3rem 0.8rem; padding: 0.5rem 0.8rem; border: 1.5px solid var(--encre-2); border-radius: 6px; background: rgba(246, 236, 212, 0.45); }
.bandeau p { margin: 0; display: flex; flex-direction: column; }
.bandeau span { order: 2; font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--encre-2); border-top: 1px solid var(--papier-ombre); }
.bandeau strong { font-family: var(--f-titre); font-size: 1.25rem; font-weight: normal; }
@media (max-width: 600px) { .bandeau { grid-template-columns: repeat(2, 1fr); } }
.compteurs { margin: 0.4rem 0 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; font-size: var(--t-s); color: var(--encre-2); }
.cadres { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: 0.6rem; }
.cadre { border: 1.5px solid var(--encre-2); border-radius: 6px; background: rgba(246, 236, 212, 0.45); overflow: hidden; }
.tete { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.5rem; background: rgba(106, 80, 55, 0.14); border-bottom: 1px solid var(--papier-ombre); }
.num { display: inline-grid; place-items: center; width: 1.7rem; height: 1.7rem; border-radius: 50%; border: 1.5px solid var(--encre-2); background: #f6ecd4; font-family: var(--f-titre); font-size: 1.05rem; }
.intitule { flex: 1; font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--encre-2); }
.emplacements { font-family: var(--f-cote); font-size: var(--t-s); padding: 0 0.4rem; border: 1px solid var(--papier-ombre); border-radius: 999px; background: #f6ecd4; }
.cadre ul { list-style: none; margin: 0; padding: 0.3rem 0.55rem 0.45rem; display: flex; flex-direction: column; }
.cadre li { padding: 0.1rem 0; border-bottom: 1px solid var(--ligne-cahier); font-size: 0.95rem; }
.cadre li.toujours { color: var(--ruban); }
.cadre li.non-prepare { color: var(--encre-2); }
.puce { display: inline-block; width: 1.1rem; font-size: 0.8rem; color: var(--encre-2); }
.vide { margin: 0; padding: 0.3rem 0.55rem; color: var(--papier-ombre); }
.edition { display: flex; flex-direction: column; gap: 0.6rem; }
.edition .rubrique { border: 1px solid rgba(90, 60, 30, 0.25); border-radius: 4px; padding: 0.4rem 0.6rem; }
.edition legend { font-weight: bold; padding: 0 0.3rem; }
.niveau { display: inline-block; min-width: 3.4rem; font-weight: bold; color: #7a5a3a; font-variant-numeric: tabular-nums; }
.niveau-sorts { display: flex; gap: 0.5rem; align-items: baseline; padding: 0.15rem 0; }
.options { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0 0.8rem; flex: 1; }
.option { display: flex; gap: 0.35rem; align-items: baseline; font-size: 0.95rem; }
.trop { color: #8a3b2c; font-weight: bold; }
.aide { margin: 0 0 0.3rem; font-style: italic; font-size: 0.92rem; }
.actions { display: flex; gap: 0.8rem; align-items: center; }
.legende { margin: 0; font-size: 0.85rem; color: var(--encre-2); }
</style>
