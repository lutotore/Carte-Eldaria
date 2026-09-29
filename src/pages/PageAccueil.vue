<script setup>
import { onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { NOMS_ROLES } from '../api/droits.js'
import { moi } from '../session.js'

const router = useRouter()

// Une seule campagne : inutile de faire choisir, on ouvre directement la carte.
onMounted(() => {
  if (moi.value?.campagnes.length === 1) router.replace({ name: 'carte', params: { id: moi.value.campagnes[0].id } })
})
</script>

<template>
  <main class="page-feuille">
    <section class="feuille papier epingle" aria-labelledby="titre">
      <h1 id="titre">Mes campagnes</h1>
      <ul v-if="moi.campagnes.length" class="campagnes">
        <li v-for="c in moi.campagnes" :key="c.id">
          <RouterLink :to="{ name: 'carte', params: { id: c.id } }">{{ c.nom }}</RouterLink>
          <span class="chapeau">{{ NOMS_ROLES[c.role] }}</span>
        </li>
      </ul>
      <p v-else class="chapeau">Tu ne fais partie d'aucune campagne pour l'instant. Demande un lien d'invitation à ton MJ.</p>
    </section>
  </main>
</template>

<style scoped>
.campagnes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.campagnes li { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; border-bottom: 1px dashed var(--papier-ombre); padding-bottom: 0.5rem; }
.campagnes a { font-family: var(--f-titre); font-size: 1.3rem; }
</style>
