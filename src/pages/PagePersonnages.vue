<script setup>
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '../api/client.js'
import { utiliserEnvoi } from '../composables/envoi.js'

/** Pour les MJ : les fiches de personnage des joueurs de la campagne. */
const props = defineProps({ id: { type: String, required: true } })
const liste = ref(null)
const { erreur, envoyer } = utiliserEnvoi()

const charger = () => envoyer(async () => { liste.value = (await api.personnages(props.id)).personnages })
onMounted(charger)
watch(() => props.id, charger)

const date = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
</script>

<template>
  <main class="page-personnages">
    <header>
      <h1>Personnages</h1>
      <p class="sous-titre">Les fiches des joueurs. Chacun crée et tient la sienne ; tu peux tout y modifier et y inscrire les Marques du Rêve.</p>
    </header>
    <p v-if="erreur" class="message message--erreur" role="alert">{{ erreur }}</p>
    <p v-if="liste && !liste.length" class="vide">Aucun joueur n’a encore créé sa fiche.</p>
    <ul class="grille">
      <li v-for="p in liste ?? []" :key="p.id">
        <RouterLink :to="{ name: 'fiche-personnage', params: { id, personnageId: p.id } }" class="carte papier">
          <strong>{{ p.nom }}</strong>
          <span>{{ [p.classe, `niveau ${p.niveau}`].filter(Boolean).join(', ') }}</span>
          <small>Joué par {{ p.joueur }} · modifiée le {{ date(p.majLe) }}</small>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.page-personnages { max-width: 1100px; margin: 0 auto; padding: 1.5rem max(16px, env(safe-area-inset-left)) 2rem; display: flex; flex-direction: column; gap: 1.2rem; }
h1 { font-size: clamp(2rem, 5vw, 2.8rem); color: var(--laiton-clair); text-shadow: 0 2px 2px rgba(0, 0, 0, 0.6); }
.sous-titre { margin: 0.2rem 0 0; color: #cdb48c; font-style: italic; }
.vide { color: #cdb48c; font-style: italic; margin: 0; }
.grille { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 1rem; }
.carte { display: flex; flex-direction: column; gap: 0.2rem; padding: 1rem; text-decoration: none; color: var(--encre); height: 100%; transition: transform 0.15s ease; }
.carte:hover { transform: rotate(-0.4deg) translateY(-2px); }
.carte strong { font-family: var(--f-titre); font-weight: 400; font-size: 1.4rem; }
.carte small { color: var(--encre-2); margin-top: auto; padding-top: 0.3rem; }
</style>
