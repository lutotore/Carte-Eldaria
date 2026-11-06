<script setup>

/**
 * Ce que les règles du site disent du personnage : aptitudes de chaque classe niveau par niveau,
 * choix faits et dons (les emplacements de sorts sont dans la barre de combat et la page Sorts). Tout est calculé par le serveur ; ici on affiche seulement.
 */
defineProps({
  regles: { type: Object, required: true },
})

/** « SRD 5.1 », ou « Livre du joueur, p. 80 ». */
const reference = ({ source, page }) => (page ? `${source}, p. ${page}` : source)
</script>

<template>
  <section class="aptitudes papier" aria-labelledby="titre-aptitudes">
    <h3 id="titre-aptitudes" class="titre">Aptitudes de classe</h3>

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

  </section>
</template>

<style scoped>
.aptitudes { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.9rem; }
.aptitudes .titre { margin: 0; font-size: 1.15rem; }
.aptitudes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); }
.aptitudes .titre, .aptitudes .bloc { grid-column: 1 / -1; }
.aptitudes h3 { margin: 0 0 0.3rem; font-size: 1.05rem; }
.aptitudes small { font-weight: normal; color: #6b5640; }
.niveaux { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.niveau { display: inline-block; min-width: 3.6rem; font-variant-numeric: tabular-nums; color: #7a5a3a; font-weight: bold; }
.choix { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 1rem; margin: 0; }
.choix dt { font-weight: bold; }
.choix dd { margin: 0; }
.dons { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.2rem; }
</style>
