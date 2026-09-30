<script setup>
import ACompleter from '../components/ACompleter.vue'
import { EDITEUR, HEBERGEUR, MISE_A_JOUR } from '../legal.js'
</script>

<template>
  <main class="page-feuille">
    <article class="feuille feuille--large papier texte-juridique" aria-labelledby="titre">
      <h1 id="titre">Mentions légales</h1>
      <p class="chapeau">Mises à jour le {{ MISE_A_JOUR }}.</p>

      <h2>Éditeur du site</h2>
      <p>
        Ce site est édité à titre personnel et non commercial par <ACompleter :valeur="EDITEUR.nom" indice="prénom et nom" />,
        joignable à l'adresse <ACompleter :valeur="EDITEUR.contact" indice="adresse de contact" />.
        Il est réservé aux membres d'une table de jeu de rôle, qui y accèdent sur invitation.
      </p>

      <h2>Directeur de la publication</h2>
      <p><ACompleter :valeur="EDITEUR.nom" indice="prénom et nom" />.</p>

      <h2>Hébergement</h2>
      <p>
        {{ HEBERGEUR.nom }}, {{ HEBERGEUR.adresse }}. Téléphone : {{ HEBERGEUR.telephone }}.
        <a :href="HEBERGEUR.site" rel="noopener noreferrer">{{ HEBERGEUR.site }}</a>. Les données sont hébergées en France.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L'univers d'Eldaria, ses textes, cartes et illustrations appartiennent à leur auteur ; toute reproduction hors de la table
        de jeu demande son accord. Dungeons &amp; Dragons est une marque de Wizards of the Coast : ce site n'est ni officiel ni
        approuvé par Wizards of the Coast. Les éléments de règles éventuellement repris proviennent du System Reference Document 5.1,
        publié par Wizards of the Coast sous licence Creative Commons Attribution 4.0.
      </p>
      <p>Polices de caractères : IM Fell DW Pica (Igino Marini), Alegreya Sans (Huerta Tipográfica) et IBM Plex Mono (IBM), sous licence SIL Open Font License, hébergées sur ce site.</p>

      <h2>Données personnelles et cookies</h2>
      <p>Voir la page <RouterLink to="/confidentialite">Confidentialité et cookies</RouterLink>.</p>
    </article>
  </main>
</template>
