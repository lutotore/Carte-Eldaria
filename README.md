# Portail d'Eldaria

Portail de la campagne *Eldaria — Le Sommeil de l'Abîme* : carte des îles en temps réel, table du MJ,
comptes des joueurs sur invitation. Tout est privé : il faut un compte pour voir quoi que ce soit.

| Rôle | Ce qu'il voit et fait |
|---|---|
| **MJ principal** (propriétaire) | Tout, plus la gestion des membres : invitations, liens de mot de passe, retraits |
| **MJ** | Toute la vérité de la campagne et la table du MJ |
| **Joueur**, **joueur occasionnel** | La carte : îles révélées, missions ouvertes, nouvelles publiées |

Le déploiement sur le VPS est décrit pas à pas dans [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Architecture

```
navigateur ──HTTPS──► Caddy ──┬── /api/*  ──► API Node (Fastify) ──► SQLite (donnees/eldaria.db)
                              └── le reste ──► site Vue compilé
```

- **`src/`** : le site Vue.
  - `src/domain/` : les règles du monde (Horloge, altitudes, brume, missions) en fonctions pures.
    **L'API réutilise le même code**, notamment `projection.js`, qui décide de ce qu'un joueur a le droit de voir.
  - `src/pages/` : une page par écran (connexion, invitation, carte, membres, compte, pages légales).
  - `src/mj/` : la table du MJ.
  - `src/api/client.js` : le seul endroit qui parle à l'API.
- **`api/`** : l'API.
  - `api/src/domaine/` : règles du portail (rôles, liens à usage unique, identifiants), fonctions pures.
  - `api/src/services/portail.js` : les cas d'usage. **C'est ici que les droits sont vérifiés.**
  - `api/src/infra/` : SQLite (`node:sqlite`, inclus dans Node) et les migrations.
  - `api/src/http/` : traduction HTTP ↔ cas d'usage, cookies, protection CSRF, limitation des tentatives.
  - `api/src/cli.js` : commandes d'administration à lancer sur le serveur.

### Pourquoi les secrets du MJ ne peuvent pas fuiter

Le site compilé ne contient **aucune donnée** : tout vient de l'API, après connexion.
L'API ne renvoie l'état complet qu'aux MJ ; les joueurs reçoivent `versPublic(etat)`.
Un test de l'API le vérifie à chaque exécution (`api/tests/services/monde.test.js`).

### Sécurité en bref

- Mots de passe hachés avec scrypt, jamais stockés ni journalisés.
- Session dans un cookie `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax` ; la base ne garde que l'empreinte du jeton.
- Toute modification doit venir du portail lui-même (en-tête `Origin` vérifié) et être envoyée en JSON.
- 10 tentatives de connexion par quart d'heure et par adresse IP.
- Les journaux ne contiennent ni adresse IP ni jeton.
- En-têtes de sécurité et politique de contenu stricte posés par Caddy (`Caddyfile`).

## Développer sur ton PC

Prérequis : Node.js 22.13 ou plus récent.

```bash
npm install
npm install --prefix api
```

Première fois seulement, pour l'API :

```bash
cd api
cp .env.exemple .env                        # sous Windows : copy .env.exemple .env
npm run cli -- initialiser "Eldaria (dev)"  # affiche un lien d'invitation de propriétaire
npm run cli -- importer-etat 1 ../mj/etat.json
```

Puis, dans deux terminaux :

```bash
npm run dev:api   # l'API sur http://localhost:3000
npm run dev       # le site sur http://localhost:5173 (il transmet /api à l'API)
```

Ouvre le lien affiché par `initialiser` pour créer ton compte. La base de développement vit dans
`api/donnees-dev/`, ignorée par Git : supprime ce dossier pour repartir de zéro.

## Tests

```bash
npm test            # tout : site (Vitest) puis API
npm run test:web    # le site seul
npm test --prefix api
```

Le code est écrit en TDD : chaque règle a d'abord été décrite par un test. Les tests de l'API
se lisent comme le cahier des charges : `api/tests/services/comptes.test.js` suit les stories 1 à 6,
`monde.test.js` les stories 7 et 8, `rgpd.test.js` les droits sur son compte.

## Données personnelles

- Pages **Mentions légales** et **Confidentialité et cookies** : `src/pages/`.
  Tes coordonnées d'éditeur se renseignent dans `src/legal.js` (en surbrillance tant qu'elles manquent).
- Un seul cookie (session, strictement nécessaire) et une préférence d'affichage en stockage local :
  aucun bandeau de consentement n'est requis. **Si tu ajoutes un jour une mesure d'audience ou un
  contenu externe (vidéo, police Google…), ce ne sera plus vrai** : il faudra un bandeau.
- Chaque utilisateur peut télécharger ses données et supprimer son compte depuis **Mon compte**.
- Les durées de conservation annoncées dans `src/legal.js` doivent rester alignées sur l'API
  (`DUREES_JOURS` dans `api/src/services/portail.js`) et sur la rétention des sauvegardes.

## Bibliothèque de PNJ : la révélation

Chaque fiche est faite de **facettes** (nom, portrait, rôle, faction, lieu, attitude, statut, description, secrets).
Chacune est cachée, révélée au groupe, ou révélée à certains joueurs. La règle tient dans une fonction pure,
`vueJoueur` (`src/domain/fiches.js`), partagée par le site et l'API : c'est elle qui décide ce qu'un joueur reçoit.
Les notes du MJ ne sortent jamais de l'API ; les portraits ne sont servis qu'à ceux qui ont le droit de les voir.

Les joueurs écrivent des **notes** et des **croyances** (privées ou partagées). Un MJ peut compter une croyance
dans le Registre des Croyances de la campagne en un clic.

## Plusieurs MJ en même temps

Chaque enregistrement de la table du MJ rappelle la **version** du monde sur laquelle il a été fait.
Si un autre MJ a enregistré entre-temps, l'API refuse (409) au lieu d'écraser son travail, et la table
propose de recharger la campagne. C'est un *verrou optimiste* : personne n'est bloqué tant qu'il n'y a pas de conflit.

## Limites connues

- Les joueurs voient les changements en rechargeant la carte, ou en revenant sur l'onglet.
  Le temps réel (SSE) viendra avec un lot suivant.
