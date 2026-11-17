<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '../api/client.js'
import { utiliserEnvoi } from '../composables/envoi.js'
import { etiquetteDe, regrouper } from '../domain/nouveautes.js'

/** « Quoi de neuf » : ce qui est arrivé dans la campagne, le plus récent en tête. Pensé d'abord pour le téléphone. */
const props = defineProps({ id: { type: String, required: true } })

const fil = ref(null)
const { erreur, envoyer } = utiliserEnvoi()
const groupes = computed(() => regrouper(fil.value?.liste ?? []))

const quand = (iso) => new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// On lit d'abord, puis on marque comme vu : ce qui était nouveau reste signalé pendant cette visite.
const charger = () => envoyer(async () => {
  fil.value = await api.quoiDeNeuf(props.id)
  if (groupes.value.nouvelles.length) await api.marquerNouveautesLues(props.id)
})
onMounted(charger)
watch(() => props.id, charger)
</script>

<template>
  <main class="nouveautes">
    <header>
      <p class="petites-capitales surtitre">Pour toi</p>
      <h1>Quoi de neuf</h1>
      <p v-if="fil" class="date">{{ fil.dateDuMonde.texte }} · {{ fil.dateDuMonde.souffle }}</p>
    </header>

    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
    <p v-else-if="fil && !fil.liste.length" class="vide">Rien de neuf pour l'instant. Le MJ n'a encore rien révélé.</p>

    <template v-for="(groupe, cle) in { nouvelles: groupes.nouvelles, deja: groupes.deja }" :key="cle">
      <section v-if="groupe.length" :aria-labelledby="`titre-${cle}`">
        <h2 :id="`titre-${cle}`">{{ cle === 'nouvelles' ? 'Nouveau' : 'Déjà vu' }}</h2>
        <ul>
          <li v-for="n in groupe" :key="n.id">
            <RouterLink :to="n.lien" class="carte papier" :class="{ nouvelle: !n.lue }">
              <span class="pastille" :class="`pastille--${n.categorie}`" aria-hidden="true" />
              <span class="texte">
                <span class="etiquette">{{ etiquetteDe(n.categorie) }}</span>
                <strong>{{ n.texte }}</strong>
                <time :datetime="n.creeLe">{{ quand(n.creeLe) }}</time>
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>

    <RouterLink :to="{ name: 'bibliotheque', params: { id } }" class="tout">Tout voir dans la Bibliothèque</RouterLink>
  </main>
</template>

<style scoped>
.nouveautes { max-width: 640px; margin: 0 auto; padding: 1.2rem max(16px, env(safe-area-inset-left)) 2rem; display: flex; flex-direction: column; gap: 1rem; }
.surtitre { margin: 0; color: #cdb48c; }
h1 { margin: 0.1rem 0 0; font-size: 2rem; color: var(--laiton-clair); }
.date { margin: 0.2rem 0 0; color: #cdb48c; }
h2 { margin: 0 0 0.5rem; font-size: 1.1rem; color: #cdb48c; font-family: var(--f-texte); font-weight: 700; }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.carte { display: flex; gap: 0.8rem; align-items: center; padding: 0.8rem; min-height: 64px; border-radius: 4px; color: var(--encre); text-decoration: none; }
.carte.nouvelle { box-shadow: inset 4px 0 0 var(--rouge), 0 14px 30px rgba(0, 0, 0, 0.5); }
.pastille { flex: none; width: 14px; height: 14px; border-radius: 50%; background: var(--papier-ombre); }
.pastille--revelations { background: var(--vert); }
.pastille--personnage { background: var(--laiton); }
.pastille--annonces { background: var(--rouge); }
.pastille--carte { background: var(--cristal); }
.pastille--seances { background: var(--brume-sombre); }
.texte { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
.etiquette { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--encre-2); }
strong { font-weight: 700; line-height: 1.3; }
time { font-size: var(--t-xs); color: var(--encre-2); }
.vide { margin: 0; color: #cdb48c; font-style: italic; }
.tout { align-self: center; min-height: 44px; display: inline-flex; align-items: center; color: var(--laiton-clair); }
</style>
