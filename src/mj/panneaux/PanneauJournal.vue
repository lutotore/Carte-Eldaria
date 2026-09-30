<script setup>
defineProps({ etat: { type: Object, required: true } })
</script>

<template>
  <div class="panneau">
    <p class="aide">Le journal se remplit tout seul : Horloge, seuils, chutes, croyances, missions.</p>
    <ol class="journal">
      <li v-for="(j, i) in etat.journal" :key="i">
        <span class="quand">{{ j.t }}</span>
        <span>{{ j.texte }}</span>
        <span class="cote delta" :class="{ hausse: j.d > 0, baisse: j.d < 0 }">{{ j.d ? `${j.d > 0 ? '+' : '−'}${Math.abs(j.d)}` : '' }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.journal { list-style: none; margin: 0; padding: 0; }
.journal li { display: grid; grid-template-columns: 7rem minmax(0, 1fr) 2.5rem; gap: 0.75rem; padding: 0.35rem 0; border-bottom: 1px dotted var(--trait); }
.quand { color: var(--encre-2); font-style: italic; }
.delta { text-align: right; }
.hausse { color: var(--ocre-alerte); }
.baisse { color: var(--vert); }
</style>
