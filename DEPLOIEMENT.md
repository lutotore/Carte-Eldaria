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

```bash
cd /opt/eldaria
git pull
docker compose up -d --build
```

Seuls les conteneurs modifiés redémarrent. La base et les certificats sont conservés.

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
