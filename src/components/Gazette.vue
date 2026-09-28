<script setup>
defineProps({ nouvelles: { type: Array, required: true } })
</script>

<template>
  <section class="gazette papier" aria-labelledby="titre-gazette">
    <header class="titre">
      <h2 id="titre-gazette">La Gazette des Vents</h2>
      <p class="petites-capitales">Nouvelles des quais et des îles</p>
    </header>
    <article v-for="(n, i) in nouvelles.slice(0, 8)" :key="`${n.t}-${i}`">
      <p class="petites-capitales quand">{{ n.t }}</p>
      <h3>{{ n.titre }}</h3>
      <p v-if="n.texte" class="texte">{{ n.texte }}</p>
    </article>
    <p v-if="!nouvelles.length" class="vide">Pas de nouvelles pour l'instant.</p>
  </section>
</template>

<style scoped>
/* Coupure de journal, bords déchirés. */
.gazette {
  background-color: #f1e7cf;
  padding: 1.4rem 1.3rem 1.8rem;
  transform: rotate(1deg);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  clip-path: polygon(0 1%, 6% 0, 14% 1.2%, 25% 0.2%, 37% 1%, 50% 0, 63% 1.1%, 75% 0.3%, 88% 1%, 100% 0, 99.4% 20%, 100% 45%, 99.3% 70%, 100% 100%, 88% 99%, 74% 100%, 60% 98.9%, 47% 100%, 33% 99%, 20% 100%, 8% 99.1%, 0 100%, 0.6% 70%, 0 40%);
}
.titre { text-align: center; border-bottom: 3px double var(--encre); padding-bottom: 0.4rem; }
h2 { font-size: 1.7rem; letter-spacing: 0.06em; }
.titre .petites-capitales { margin: 0.1rem 0 0; color: var(--encre-2); }
article { display: flex; flex-direction: column; gap: 0.1rem; border-bottom: 1px solid rgba(45, 31, 21, 0.25); padding-bottom: 0.7rem; }
article:last-of-type { border-bottom: 0; }
.quand { margin: 0; color: var(--encre-2); }
h3 { font-size: 1.2rem; line-height: 1.25; }
.texte { margin: 0; font-size: 0.95rem; }
.vide { margin: 0; font-style: italic; color: var(--encre-2); }
</style>
