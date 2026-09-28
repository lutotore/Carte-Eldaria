<script setup>
defineProps({ nouvelles: { type: Array, required: true } })
</script>

<template>
  <section class="gazette" aria-labelledby="titre-gazette">
    <h2 id="titre-gazette">La Gazette des Vents</h2>
    <article v-for="(n, i) in nouvelles.slice(0, 8)" :key="`${n.t}-${i}`">
      <p class="petites-capitales">{{ n.t }}</p>
      <h3>{{ n.titre }}</h3>
      <p v-if="n.texte" class="texte">{{ n.texte }}</p>
    </article>
    <p v-if="!nouvelles.length" class="vide">Pas de nouvelles pour l'instant.</p>
  </section>
</template>

<style scoped>
.gazette { display: flex; flex-direction: column; gap: 0.8rem; }
h2 { font-size: var(--t-l); }
article { display: flex; flex-direction: column; gap: 0.1rem; }
h3 { font-size: 1.15rem; }
.texte { margin: 0; font-size: 0.95rem; }
.vide { margin: 0; color: var(--encre-2); }
</style>
