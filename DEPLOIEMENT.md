# Mettre le portail en ligne sur le VPS

Prérequis, déjà faits : VPS Ubuntu sécurisé (clé SSH, ufw 22/80/443, fail2ban), Docker et Docker Compose installés,
sous-domaine qui pointe vers l'IP du VPS (enregistrements A et AAAA).

Dans ce guide, remplace `eldaria.mondomaine.fr` par ton vrai sous-domaine.

---

## 0. Avant de pousser : couper GitHub Pages

L'ancienne carte publique reste en ligne sur GitHub Pages tant qu'on ne la retire pas.
Sur GitHub : **Settings → Pages → Unpublish site** (ou « Source : None »).
Le nouveau workflow (`.github/workflows/tester.yml`) ne fait plus que lancer les tests.

## 1. Tes coordonnées légales

Ouvre `src/legal.js` et remplis `nom` et `contact`. Ces informations sont obligatoires sur les pages légales.
Le dépôt étant public, elles y seront visibles : c'est normal, elles le sont aussi sur le site.
Une adresse e-mail dédiée (un alias) évite d'exposer ton adresse principale.

Commite et pousse.

## 2. Récupérer le code sur le serveur

```bash
ssh eldaria
sudo mkdir -p /opt/eldaria
sudo chown "$USER": /opt/eldaria
git clone https://github.com/lutotore/Carte-Eldaria.git /opt/eldaria
cd /opt/eldaria
```

`/opt` est l'emplacement habituel des applications installées à la main. Le dépôt étant public,
aucun identifiant n'est nécessaire pour le cloner.

## 3. Les réglages

```bash
cp .env.exemple .env
nano .env        # DOMAINE=eldaria.mondomaine.fr
```

Le fichier `.env` est lu automatiquement par Docker Compose. Il est ignoré par Git.

## 4. Le dossier de la base de données

```bash
mkdir donnees
sudo chown 1000:1000 donnees
```

L'API tourne sous l'utilisateur `node` (numéro 1000) et jamais en root : elle doit pouvoir écrire dans ce dossier.
C'est **ce dossier qu'il faudra sauvegarder**.

## 5. Premier démarrage

```bash
docker compose up -d --build
```

La première construction prend quelques minutes (téléchargement des images Node et Caddy, compilation du site).

Pour vérifier :

```bash
docker compose ps              # api doit être « healthy », web « running »
docker compose logs web        # cherche « certificate obtained successfully »
```

Ouvre `https://eldaria.mondomaine.fr` : la page de connexion doit s'afficher avec le cadenas HTTPS.

Si `docker compose up` refuse de créer le réseau à cause d'IPv6, copie-moi le message :
la ligne `enable_ipv6` de `docker-compose.yml` dépend de la configuration de Docker.

## 6. Créer la campagne et ton compte

```bash
docker compose exec api npm run -s cli -- initialiser "Eldaria"
```

La commande affiche un lien `https://eldaria.mondomaine.fr/invitation/…`. Ouvre-le, choisis ton identifiant
et ton mot de passe : tu es le **MJ principal** de la campagne n° 1. Le lien est à usage unique et expire dans 7 jours.

## 7. Importer ton monde

Depuis ton PC (PowerShell), envoie `mj\etat.json` sur le serveur :

```powershell
scp mj\etat.json eldaria:/tmp/etat.json
```

Puis sur le serveur :

```bash
cd /opt/eldaria
docker compose exec -T api npm run -s cli -- importer-etat 1 < /tmp/etat.json
rm /tmp/etat.json
```

`-T` permet de faire passer le fichier dans le conteneur par l'entrée standard.
À partir de là, **la référence est la base du serveur**, plus ton `mj/etat.json`.

## 8. Inviter les joueurs

Sur le site : **Membres → Inviter quelqu'un comme… → Créer un lien d'invitation**, puis envoie le lien.
Pour le co-MJ, crée deux liens : un **MJ** et un **Joueur**, qui donneront deux comptes séparés.

---

## Mettre à jour après un changement de code

Une fois le déploiement automatique en place (section suivante), **il suffit de pousser sur `main`** :
GitHub lance les tests, puis met le serveur à jour s'ils sont verts. Suis l'avancement dans l'onglet **Actions**.

À la main, si besoin :

```bash
cd /opt/eldaria
git pull
docker compose up -d --build
```

## Déploiement automatique (à mettre en place une fois)

### Comment ça marche

Après des tests verts sur `main`, GitHub se connecte au VPS avec une **clé SSH dédiée**. Cette clé est bridée :
dans `authorized_keys`, une *commande forcée* l'oblige à lancer `/usr/local/bin/eldaria-deployer` et rien d'autre
(`git pull` puis `docker compose up -d --build`). Le script est installé hors du dépôt : un commit ne peut pas changer
ce que la clé a le droit de faire.

**Important** : quiconque peut pousser sur `main` peut désormais modifier le serveur. Active la
**double authentification** sur ton compte GitHub (Settings → Password and authentication).

### Partie 1 : sur ton Mac (ou n'importe quel ordinateur)

1. Crée la clé de déploiement, **sans phrase de passe** (GitHub doit pouvoir l'utiliser seul ; c'est la commande forcée qui la rend inoffensive) :
   ```bash
   ssh-keygen -t ed25519 -N "" -C "deploiement-github-eldaria" -f ~/.ssh/eldaria_deploiement
   ```
2. Relève l'empreinte du serveur (aucune connexion n'est nécessaire, remplace l'IP) :
   ```bash
   ssh-keyscan -t ed25519 IP_DU_VPS
   ```
   Garde la ligne affichée (elle commence par l'IP, puis `ssh-ed25519 AAAA…`).
3. Sur GitHub, dépôt → **Settings → Secrets and variables → Actions** :
   - onglet **Secrets**, bouton **New repository secret** :
     | Nom | Valeur |
     |---|---|
     | `DEPLOIEMENT_CLE` | tout le contenu de `~/.ssh/eldaria_deploiement` (`pbcopy < ~/.ssh/eldaria_deploiement` le copie), lignes BEGIN et END comprises |
     | `DEPLOIEMENT_HOTE` | l'IP du VPS |
     | `DEPLOIEMENT_EMPREINTE_HOTE` | la ligne donnée par `ssh-keyscan` |
   - onglet **Variables**, bouton **New repository variable** :
     | Nom | Valeur |
     |---|---|
     | `DOMAINE` | `eldaria.mondomaine.fr` |
4. Garde de côté le contenu de `~/.ssh/eldaria_deploiement.pub` (la partie publique, sans risque : envoie-la-toi par message).
5. Supprime la partie privée du Mac, seul GitHub en a besoin : `rm ~/.ssh/eldaria_deploiement`.

### Partie 2 : sur le serveur (depuis un ordinateur qui a déjà accès)

```bash
ssh eldaria
cd /opt/eldaria && git pull
```

1. Installe le script hors du dépôt, propriété de root :
   ```bash
   sudo install -m 755 -o root -g root /opt/eldaria/scripts/deployer.sh /usr/local/bin/eldaria-deployer
   ```
2. Vérifie que l'empreinte relevée à l'étape 2 est bien celle du serveur :
   ```bash
   cat /etc/ssh/ssh_host_ed25519_key.pub
   ```
   La longue suite `AAAA…` doit être **identique** à celle de ta ligne `ssh-keyscan`. Sinon, arrête-toi et préviens-moi.
3. Autorise la clé de déploiement, bridée :
   ```bash
   nano ~/.ssh/authorized_keys
   ```
   Ajoute **une nouvelle ligne** à la fin (sans toucher aux autres), en collant ta clé publique après le préfixe :
   ```
   restrict,command="/usr/local/bin/eldaria-deployer" ssh-ed25519 AAAA… deploiement-github-eldaria
   ```
   `restrict` interdit tout le reste (terminal, redirections de ports…).

### Partie 3 : activer et tester

1. Sur GitHub, onglet **Variables**, ajoute `DEPLOIEMENT_ACTIF` avec la valeur `oui`.
   Tant que cette variable n'existe pas, le workflow teste mais ne déploie pas : c'est ce qui évite des échecs en attendant.
2. Onglet **Actions → Tester et déployer → Run workflow** (branche `main`).
3. Les deux étapes doivent passer au vert ; la dernière vérifie que `https://<ton domaine>/api/sante` répond.

Pour couper le déploiement automatique : passe `DEPLOIEMENT_ACTIF` à `non`. Pour révoquer la clé : supprime sa ligne
dans `~/.ssh/authorized_keys` sur le serveur.

Si tu modifies un jour `scripts/deployer.sh`, relance la commande `sudo install …` de la partie 2 : le serveur n'utilise
jamais directement la version du dépôt.

## Importer les PNJ préparés (bibliothèque)

Le fichier `pnj-acte-1.json` contient tous les PNJ de l'Acte I (descriptions, secrets, notes MJ, prompts de portraits).
Il contient des spoilers : garde-le dans `mj/`, jamais dans le dépôt. Depuis ton PC :

```powershell
scp mj/pnj-acte-1.json eldaria:/tmp/pnj.json
```

Puis sur le serveur :

```bash
cd /opt/eldaria
docker compose exec -T api npm run -s cli -- importer-fiches 1 < /tmp/pnj.json
rm /tmp/pnj.json
```

Même chose pour les autres fichiers préparés (`creatures-acte-1.json`, `lieux-acte-1.json`, `documents-acte-1.json`) :
seul le nom du fichier change. Les lieux arrivent déjà rattachés à leur île.

Toutes les fiches arrivent **cachées** : les joueurs ne voient rien tant que tu ne révèles pas, facette par facette.
Les portraits se téléversent ensuite depuis chaque fiche ; ils sont stockés dans `donnees/images/`, à côté de la base.

## Commandes utiles

| Besoin | Commande (dans `/opt/eldaria`) |
|---|---|
| Voir les journaux de l'API | `docker compose logs -f api` |
| Voir les journaux de Caddy | `docker compose logs -f web` |
| Tu as perdu ton mot de passe | `docker compose exec api npm run -s cli -- reinitialiser tom` |
| Copie du monde de la campagne 1 | `docker compose exec -T api npm run -s cli -- exporter-etat 1 > etat-$(date +%F).json` |
| Redémarrer | `docker compose restart` |
| Tout arrêter | `docker compose down` (les données restent dans `donnees/`) |

## Et ensuite : les sauvegardes

En attendant la mise en place de restic, fais une copie du monde après chaque séance avec la commande
`exporter-etat` ci-dessus et rapatrie-la sur ton PC (`scp eldaria:/opt/eldaria/etat-*.json .`).
La politique de confidentialité annonce des sauvegardes de 6 mois au plus : restic devra être réglé en conséquence.
