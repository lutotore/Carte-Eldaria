<script setup>
import { api } from '../../api/client.js'

defineProps({
  campagneId: { type: [String, Number], required: true },
  imageId: { type: String, default: null },
  nom: { type: String, default: '' },
  taille: { type: String, default: 'petit' },
  /** Type de fiche : choisit l'illustration par défaut (silhouette, paysage ou parchemin). */
  genre: { type: String, default: 'pnj' },
})
</script>

<template>
  <div class="portrait" :class="`portrait--${taille}`">
    <img v-if="imageId" :src="api.urlImage(campagneId, imageId)" :alt="nom ? (['pnj', 'creature'].includes(genre) ? `Portrait de ${nom}` : nom) : 'Illustration'" loading="lazy">
    <svg v-else viewBox="0 0 60 80" role="img" :aria-label="genre === 'document' ? 'Document' : 'Pas d’illustration'">
      <rect width="60" height="80" fill="currentColor" opacity=".08" />
      <g v-if="genre === 'lieu'" fill="currentColor" opacity=".35">
        <path d="M4 62l16-22 10 12 8-9 18 19z" />
        <circle cx="44" cy="22" r="6" />
      </g>
      <g v-else-if="genre === 'document'" fill="none" stroke="currentColor" stroke-width="2" opacity=".45">
        <path d="M14 10h26l8 8v52H14z" />
        <path d="M20 28h20M20 36h22M20 44h18M20 52h20" />
      </g>
      <g v-else-if="genre === 'objet'" fill="currentColor" opacity=".35">
        <path d="M30 12l14 16-14 34-14-34z" />
        <path d="M16 28h28" stroke="currentColor" stroke-width="1.5" opacity=".6" />
      </g>
      <g v-else fill="currentColor" opacity=".35">
        <circle cx="30" cy="30" r="12" />
        <path d="M10 76c2-16 10-24 20-24s18 8 20 24" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.portrait { color: var(--encre-2); background: var(--papier-2); border: 1px solid var(--papier-ombre); box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.15); overflow: hidden; }
.portrait img, .portrait svg { display: block; width: 100%; height: 100%; object-fit: cover; }
.portrait--petit { width: 72px; aspect-ratio: 3 / 4; flex: none; }
.portrait--grand { width: min(260px, 100%); aspect-ratio: 2 / 3; }
</style>
