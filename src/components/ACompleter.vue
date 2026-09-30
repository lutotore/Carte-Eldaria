<script setup>
defineProps({ valeur: { type: String, default: null }, indice: { type: String, required: true } })
</script>

<template>
  <span v-if="valeur">{{ valeur }}</span>
  <mark v-else class="a-completer">[à compléter : {{ indice }}]</mark>
</template>
