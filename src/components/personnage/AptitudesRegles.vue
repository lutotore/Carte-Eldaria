<script setup>
import { computed } from 'vue'

/**
 * Ce que les règles du site disent du personnage : aptitudes de chaque classe niveau par niveau,
 * choix faits, dons et emplacements de sorts. Tout est calculé par le serveur ; ici on affiche seulement.
 */
const props = defineProps({
  regles: { type: Object, required: true },
})

/** « SRD 5.1 », ou « Livre du joueur, p. 80 ». */
const reference = ({ source, page }) => (page ? `${source}, p. ${page}` : source)
const NIVEAUX_DE_SORT = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const aDesSorts = computed(() => props.regles.emplacements.sorts.length > 0 || props.regles.emplacements.pacte)
</script>

<template>
  <section class="aptitudes papier" aria-labelledby="titre-aptitudes">
    <h2 id="titre-aptitudes">Aptitudes</h2>

    <article v-for="c in regles.classes" :key="c.id" class="classe">
      <h3>
        {{ c.nom }} {{ c.niveau }}
        <template v-if="c.sousClasse">— {{ c.sousClasse.nom }} <small v-if="c.sousClasse.source">({{ reference(c.sousClasse) }})</small></template>
      </h3>
      <ol class="niveaux">
        <li v-for="n in c.niveaux" :key="n.niveau"><span class="niveau">Niv. {{ n.niveau }}</span> {{ n.aptitudes.join(' · ') }}</li>
      </ol>
    </article>

    <div v-if="regles.choix.length" class="bloc">
      <h3>Choix</h3>
      <dl class="choix">
        <template v-for="c in regles.choix" :key="c.libelle">
          <dt>{{ c.libelle }}</dt>
          <dd>{{ c.valeurs.join(', ') }}</dd>
        </template>
      </dl>
    </div>

    <div v-if="regles.dons.length" class="bloc">
      <h3>Dons</h3>
      <ul class="dons">
        <li v-for="d in regles.dons" :key="d.id">
          <strong>{{ d.nom }}</strong><template v-if="d.resume"> — {{ d.resume }}</template>
          <small v-if="d.source"> ({{ reference(d) }})</small>
        </li>
      </ul>
    </div>

    <div v-if="aDesSorts" class="bloc">
      <h3>Emplacements de sorts</h3>
      <table v-if="regles.emplacements.sorts.length" class="emplacements">
        <thead><tr><th scope="row">Niveau</th><th v-for="n in NIVEAUX_DE_SORT.slice(0, regles.emplacements.sorts.length)" :key="n" scope="col">{{ n }}</th></tr></thead>
        <tbody><tr><th scope="row">Emplacements</th><td v-for="(nombre, i) in regles.emplacements.sorts" :key="i">{{ nombre }}</td></tr></tbody>
      </table>
      <p v-if="regles.emplacements.pacte" class="pacte">
        Magie de pacte : {{ regles.emplacements.pacte.nombre }} emplacement{{ regles.emplacements.pacte.nombre > 1 ? 's' : '' }}
        de niveau {{ regles.emplacements.pacte.niveau }}, récupérés au repos court.
      </p>
    </div>
  </section>
</template>

<style scoped>
.aptitudes { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.9rem; }
.aptitudes h2 { margin: 0; }
.aptitudes h3 { margin: 0 0 0.3rem; font-size: 1.05rem; }
.aptitudes small { font-weight: normal; color: #6b5640; }
.niveaux { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.niveau { display: inline-block; min-width: 3.6rem; font-variant-numeric: tabular-nums; color: #7a5a3a; font-weight: bold; }
.choix { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 1rem; margin: 0; }
.choix dt { font-weight: bold; }
.choix dd { margin: 0; }
.dons { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.2rem; }
.emplacements { border-collapse: collapse; font-variant-numeric: tabular-nums; }
.emplacements th, .emplacements td { border: 1px solid rgba(90, 60, 30, 0.35); padding: 0.2rem 0.6rem; text-align: center; }
.emplacements th[scope='row'] { text-align: left; }
.pacte { margin: 0.4rem 0 0; }
</style>
