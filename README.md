# Carte des Cieux d'Eldaria

Carte des îles de la campagne *Eldaria — Le Sommeil de l'Abîme* : altitude des îles relevées,
niveau de la mer de brume, ordres de mission et Gazette des Vents.

- **Les joueurs** consultent le site publié sur GitHub Pages.
- **Le MJ** pilote la campagne depuis une table locale qui n'est jamais publiée.

## Comment ça marche

```
mj/etat.json  ──(table du MJ, en local)──►  public/monde.json  ──(git push)──►  GitHub Pages
  secrets du MJ                               ce que voient les joueurs            site des joueurs
```

`mj/etat.json` contient tout : Horloge d'Éveil, croyances, îles et missions cachées, notes.
Il est ignoré par Git. À chaque action, la table du MJ en tire `public/monde.json`, qui ne contient
que les îles révélées, les missions ouvertes et les nouvelles publiées (voir `src/domain/projection.js`).

## Installation

Prérequis : Node.js 22.

```bash
npm install
cp /chemin/vers/etat.json mj/etat.json   # le fichier de départ fourni à part
```

## En session

```bash
npm run mj
```

Le navigateur s'ouvre sur la table du MJ : la carte telle que les joueurs la verront, puis tes outils.

- **Horloge d'Éveil** : chaque événement la fait avancer ou reculer ; les altitudes, la brume et les chutes
  d'îles sont recalculées, et les seuils franchis apparaissent en alerte avec une nouvelle prête à publier.
- **Croyances** : note chaque indice et la lecture vers laquelle le groupe penche.
- **Factions et personnages** : réputations (−3 à +3) et Marques du Rêve (0 à 5).
- **Îles** : révéler, rendre l'altitude connue, régler la vitesse de descente, faire tomber une île.
- **Missions** : ouvrir, suivre, accomplir. Accomplir une expédition coûte +1 à l'Horloge.
- **Annuler la dernière action** en cas d'erreur.

## Après la session

```bash
npm run publier
```

Le script versionne `public/monde.json` avec le nom de la session et pousse. GitHub Actions teste,
construit et déploie ; la carte des joueurs est à jour une à deux minutes plus tard.

## Première mise en ligne

1. Crée un dépôt GitHub (public : GitHub Pages gratuit ne sert que les dépôts publics, et rien de secret n'y entre).
2. Pousse ce projet sur la branche `main`.
3. Dans **Settings → Pages**, choisis **Source : GitHub Actions**.
4. La carte est servie à `https://<ton-compte>.github.io/<nom-du-depot>/`.

## Développement

```bash
npm test          # tests du modèle du monde (Vitest)
npm run dev       # la carte des joueurs seule, avec public/monde.json
npm run build     # le site publié, dans dist/
```

- `src/domain/` : le modèle du monde, en fonctions pures et testées (Horloge, altitudes, brume, missions, projection publique).
- `src/components/` : la carte des joueurs (élévation, plan, fiche de relevé, ordres, gazette).
- `src/mj/` : la table du MJ, chargée uniquement en développement et absente du site publié.
- `scripts/vite-plugin-mj.js` : le petit serveur local qui lit et écrit `mj/etat.json`.

Les règles propres à la campagne (seuils, événements, lectures, factions) vivent dans `mj/etat.json`, pas
dans le code : le dépôt public ne révèle rien de l'intrigue.
