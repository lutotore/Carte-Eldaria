<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import BarreDuPortail from './components/BarreDuPortail.vue'
import { moi } from './session.js'

const route = useRoute()
const barreVisible = computed(() => Boolean(moi.value && route.meta.connecte))
</script>

<template>
  <BarreDuPortail v-if="barreVisible" />
  <RouterView />
  <footer class="pied">
    <RouterLink to="/mentions-legales">Mentions légales</RouterLink>
    <span aria-hidden="true">·</span>
    <RouterLink to="/confidentialite">Confidentialité et cookies</RouterLink>
  </footer>
</template>

<style scoped>
.pied {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem 0.7rem;
  padding: 1rem 16px 2rem;
  font-size: var(--t-s);
  color: #cdb48c;
}
.pied a { color: #cdb48c; }
.pied a:hover { color: var(--laiton-clair); }
</style>
