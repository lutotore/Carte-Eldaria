<script setup>
import { api } from '../../api/client.js'

defineProps({
  campagneId: { type: [String, Number], required: true },
  imageId: { type: String, default: null },
  nom: { type: String, default: '' },
  taille: { type: String, default: 'petit' },
})
</script>

<template>
  <div class="portrait" :class="`portrait--${taille}`">
    <img v-if="imageId" :src="api.urlImage(campagneId, imageId)" :alt="nom ? `Portrait de ${nom}` : 'Portrait'" loading="lazy">
    <svg v-else viewBox="0 0 60 80" role="img" aria-label="Pas de portrait">
      <rect width="60" height="80" fill="currentColor" opacity=".08" />
      <circle cx="30" cy="30" r="12" fill="currentColor" opacity=".35" />
      <path d="M10 76c2-16 10-24 20-24s18 8 20 24" fill="currentColor" opacity=".35" />
    </svg>
  </div>
</template>

<style scoped>
.portrait { color: var(--encre-2); background: var(--papier-2); border: 1px solid var(--papier-ombre); box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.15); overflow: hidden; }
.portrait img, .portrait svg { display: block; width: 100%; height: 100%; object-fit: cover; }
.portrait--petit { width: 72px; aspect-ratio: 3 / 4; flex: none; }
.portrait--grand { width: min(260px, 100%); aspect-ratio: 2 / 3; }
</style>
