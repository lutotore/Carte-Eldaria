<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { campagneDe, estMj } from './api/droits.js'
import BarreDuBas from './components/BarreDuBas.vue'
import BarreDuPortail from './components/BarreDuPortail.vue'
import PupitreDeSeance from './components/seance/PupitreDeSeance.vue'
import { pupitreDe } from './composables/pupitre.js'
import { moi } from './session.js'

const route = useRoute()
const barreVisible = computed(() => Boolean(moi.value && route.meta.connecte))
/** Le pupitre de séance reste à côté de toutes les pages de la campagne, pour le MJ qui l'a ouvert. */
const pupitreVisible = computed(() => {
  const id = route.params.id
  if (!barreVisible.value || !id) return false
  return estMj(campagneDe(moi.value, id)) && pupitreDe(id).ouvert
})
</script>

<template>
  <BarreDuPortail v-if="barreVisible" />
  <!-- La page reste montée quand on ouvre ou ferme le pupitre : rien ne se recharge. -->
  <div :class="{ 'avec-pupitre': pupitreVisible }">
    <div class="page"><RouterView /></div>
    <PupitreDeSeance v-if="pupitreVisible" :campagne-id="String(route.params.id)" class="cote" />
  </div>
  <BarreDuBas v-if="barreVisible" />
  <footer class="pied" :class="{ 'pied--barre': barreVisible && route.params.id }">
    <RouterLink to="/mentions-legales">Mentions légales</RouterLink>
    <span aria-hidden="true">·</span>
    <RouterLink to="/confidentialite">Confidentialité et cookies</RouterLink>
  </footer>
</template>

<style scoped>
/* Le pupitre se range à droite sur grand écran, sous la page sur un écran étroit. */
.avec-pupitre { display: flex; flex-wrap: wrap; align-items: stretch; }
.avec-pupitre .page { flex: 999 1 560px; min-width: 0; }
.cote { flex: 1 1 360px; max-width: 460px; }
@media (min-width: 960px) {
  .cote { position: sticky; top: 0; align-self: flex-start; max-height: 100vh; overflow-y: auto; }
}
@media (max-width: 959px) {
  .cote { max-width: none; border-left: 0; border-top: 2px solid var(--laiton); }
}
.pied {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem 0.7rem;
  padding: 1rem 16px 2rem;
  font-size: var(--t-s);
  color: #cdb48c;
}
/* Sur téléphone, la barre du bas ne doit jamais cacher le pied de page. */
@media (max-width: 719px) {
  .pied--barre { padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); }
}
.pied a { color: #cdb48c; }
.pied a:hover { color: var(--laiton-clair); }
</style>
