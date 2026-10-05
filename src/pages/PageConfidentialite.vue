<script setup>
import ACompleter from '../components/ACompleter.vue'
import { DUREES, EDITEUR, HEBERGEUR, MISE_A_JOUR } from '../legal.js'
import { moi } from '../session.js'
</script>

<template>
  <main class="page-feuille">
    <article class="feuille feuille--large papier texte-juridique" aria-labelledby="titre">
      <h1 id="titre">Confidentialité et cookies</h1>
      <p class="chapeau">Mise à jour le {{ MISE_A_JOUR }}. En résumé : le strict minimum est collecté, rien n'est revendu ni partagé, aucun pistage.</p>

      <h2>Qui est responsable de tes données ?</h2>
      <p>
        <ACompleter :valeur="EDITEUR.nom" indice="prénom et nom" />, qui édite ce site à titre personnel
        (contact : <ACompleter :valeur="EDITEUR.contact" indice="adresse de contact" />).
      </p>

      <h2>Quelles données, et pourquoi ?</h2>
      <ul>
        <li><strong>Ton identifiant</strong>, que tu choisis librement (un pseudonyme convient très bien) : il te permet de te connecter et permet aux MJ de savoir qui est membre de la campagne.</li>
        <li><strong>L'empreinte de ton mot de passe</strong> : le mot de passe lui-même n'est jamais conservé, seulement une empreinte calculée avec l'algorithme scrypt, dont on ne peut pas retrouver le mot de passe.</li>
        <li><strong>Ton rôle et ta date d'arrivée</strong> dans chaque campagne : ils déterminent ce que tu peux voir.</li>
        <li><strong>Tes sessions de connexion</strong> : leur date d'ouverture et d'expiration, pour te garder connecté·e sans redemander ton mot de passe.</li>
        <li><strong>Tes disponibilités</strong> (joueurs uniquement) : pour chaque date proposée, oui ou non et ta plage horaire, pour trouver une date qui convient à la table.</li>
        <li><strong>Tes notes et croyances</strong> sur les fiches de la bibliothèque (personnages, créatures, lieux, documents), que tu écris et choisis de garder privées ou de partager avec le groupe.</li>
        <li><strong>Tes estimations</strong> des statistiques d'une créature (« CA autour de 14 »), partagées avec le groupe et signées de ton identifiant.</li>
        <li><strong>Ta fiche de personnage</strong> (joueurs) : ce que tu y écris (caractéristiques, histoire, notes…), ta bourse, ton inventaire, et les Marques du Rêve qu'un MJ y inscrit.</li>
        <li><strong>Tes notes du calendrier</strong> : les rendez-vous ou échéances que tu y notes, privés ou partagés avec le groupe.</li>
        <li><strong>Tes prises dans les butins</strong> : ce que tu as pris (« lea prend 2 × Potion de soins ») et quand, visible de la table.</li>
        <li><strong>Tes notifications</strong> : les messages du portail qui te sont adressés (sondage ouvert, séance fixée ou annulée) et s'ils ont été lus.</li>
        <li><strong>Ton adresse IP</strong>, uniquement en mémoire et pendant 15 minutes au plus, pour limiter les tentatives de connexion répétées. Elle n'est enregistrée ni dans la base ni dans les journaux du serveur.</li>
      </ul>
      <p>Aucune adresse e-mail, aucun nom réel, aucune donnée de paiement ne sont demandés.</p>
      <p>
        Base légale : la fourniture du service que tu as demandé en acceptant ton invitation (article 6.1.b du RGPD) ;
        pour la limitation des tentatives de connexion, l'intérêt légitime à protéger les comptes (article 6.1.f).
      </p>

      <h2>Qui peut les voir ?</h2>
      <ul>
        <li>Les MJ de ta campagne voient ton identifiant, ton rôle et ta date d'arrivée.</li>
        <li>Une note privée n'est lue que par toi et par les MJ ; une note partagée, par tous les membres qui connaissent le personnage concerné. Un MJ peut reporter une croyance dans le registre de la campagne, avec son texte.</li>
        <li>Une note privée du calendrier n'est lue que par toi et par les MJ ; une note partagée, par tous les membres de la campagne.</li>
        <li>Ta fiche de personnage n'est lue et modifiée que par toi et par les MJ de la campagne.</li>
        <li>Le journal d'un butin (qui a pris quoi) est visible des MJ et des joueurs tant que le butin est ouvert.</li>
        <li>Les réponses à un sondage de dates sont visibles des MJ et des autres joueurs réguliers de la campagne, comme sur un sondage de dates classique.</li>
        <li>L'hébergeur, {{ HEBERGEUR.nom }}, stocke les données sur ses serveurs situés en France, pour le compte de l'éditeur.</li>
        <li>Les données ne quittent pas l'Union européenne et ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires.</li>
      </ul>

      <h2>Combien de temps sont-elles gardées ?</h2>
      <ul>
        <li>Ton compte : jusqu'à ce que tu le supprimes. S'il ne fait plus partie d'aucune campagne, il est supprimé automatiquement dès l'expiration de ta dernière session, soit {{ DUREES.sessionJours }} jours au plus après ta dernière connexion.</li>
        <li>Les sessions : {{ DUREES.sessionJours }} jours, ou jusqu'à ta déconnexion.</li>
        <li>Les liens d'invitation et de réinitialisation : valables {{ DUREES.invitationJours }} et {{ DUREES.reinitialisationJours }} jours ; ils sont effacés au plus tard 24 heures après avoir servi ou expiré.</li>
        <li>Tes estimations : jusqu'à ce qu'un joueur les remplace ou les efface, ou avec ton compte.</li>
        <li>Tes notes et croyances : jusqu'à ce que tu les supprimes, ou avec ton compte. Une croyance reportée dans le registre de la campagne y reste, sans ton identifiant.</li>
        <li>Ta fiche de personnage : jusqu'à ce que tu la supprimes, que tu quittes la campagne, ou avec ton compte.</li>
        <li>Tes notes du calendrier : jusqu'à ce que tu les supprimes, que tu quittes la campagne, ou avec ton compte.</li>
        <li>Tes prises dans les butins : jusqu'à ce que le MJ supprime le butin, ou avec ton compte.</li>
        <li>Tes disponibilités : {{ DUREES.disponibilitesJours }} jours après la dernière date proposée par le sondage.</li>
        <li>Les notifications : {{ DUREES.notificationsLuesJours }} jours après leur lecture, et {{ DUREES.notificationsJours }} jours au plus.</li>
        <li>Les copies de sauvegarde, qui protègent la campagne contre une panne : {{ DUREES.sauvegardesMois }} mois au plus. Une donnée supprimée disparaît donc des sauvegardes au bout de ce délai.</li>
      </ul>

      <h2>Tes droits</h2>
      <p>Tu peux à tout moment :</p>
      <ul>
        <li><strong>accéder à tes données et les récupérer</strong> dans un fichier (droit d'accès et de portabilité) ;</li>
        <li><strong>supprimer ton compte</strong> et tout ce qui s'y rattache (droit à l'effacement) ;</li>
        <li><strong>faire corriger une donnée</strong>, t'opposer à un traitement ou en demander la limitation, en écrivant au contact ci-dessus.</li>
      </ul>
      <p v-if="moi">Les deux premiers se font directement depuis la page <RouterLink to="/compte">Mon compte</RouterLink>.</p>
      <p v-else>Les deux premiers se font directement depuis la page « Mon compte », une fois connecté·e.</p>
      <p>Si tu estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la CNIL : <a href="https://www.cnil.fr/fr/plaintes" rel="noopener noreferrer">www.cnil.fr/fr/plaintes</a>.</p>

      <h2>Sécurité</h2>
      <p>Connexions chiffrées (HTTPS), mots de passe hachés avec scrypt, jetons de session et liens conservés uniquement sous forme d'empreinte, tentatives de connexion limitées.</p>

      <h2>Cookies et stockage sur ton appareil</h2>
      <p>Ce site dépose un seul cookie et utilise un seul élément de stockage local. Tous deux sont indispensables ou à ton seul usage : ils sont donc dispensés de consentement, et c'est pourquoi aucun bandeau ne te le demande.</p>
      <div class="tableau">
        <table>
          <thead><tr><th scope="col">Nom</th><th scope="col">Type</th><th scope="col">Rôle</th><th scope="col">Durée</th></tr></thead>
          <tbody>
            <tr>
              <td><code>__Host-eldaria_session</code></td>
              <td>Cookie strictement nécessaire</td>
              <td>Te garde connecté·e. Il est illisible par les scripts de la page et n'est jamais envoyé à un autre site.</td>
              <td>{{ DUREES.sessionJours }} jours, ou jusqu'à la déconnexion</td>
            </tr>
            <tr>
              <td><code>eldaria-vue</code></td>
              <td>Stockage local (préférence d'affichage)</td>
              <td>Retient si tu préfères la carte en élévation ou en plan. Il reste sur ton appareil et n'est jamais transmis.</td>
              <td>Jusqu'à ce que tu l'effaces</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Les boutons « Ajouter à Google Agenda » sont de simples liens : rien n'est transmis à Google tant que tu ne cliques pas.
        Si tu cliques, la date, l'horaire, le nom de la campagne et le lieu de la séance sont envoyés à Google, selon ses propres règles de confidentialité.
        Le fichier « .ics », lui, est fabriqué directement dans ton navigateur.
      </p>
      <p>Aucun cookie de mesure d'audience, de publicité ou de réseau social n'est utilisé, et aucune ressource n'est chargée depuis un autre site : les polices de caractères sont hébergées ici. Tu peux supprimer ces éléments à tout moment dans les réglages de ton navigateur ; supprimer le cookie de session revient à te déconnecter.</p>
    </article>
  </main>
</template>

<style scoped>
.tableau { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
th { text-align: left; font-weight: 400; font-style: italic; color: var(--encre-2); border-bottom: 1.5px solid var(--encre); padding: 0.3rem 0.5rem; }
td { border-bottom: 1px solid rgba(45, 31, 21, 0.18); padding: 0.5rem; vertical-align: top; }
code { font-family: var(--f-cote); font-size: 0.85em; }
</style>
