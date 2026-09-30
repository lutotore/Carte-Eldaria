#!/usr/bin/env bash
# Déploiement du portail, lancé par GitHub Actions.
#
# Ce script est installé HORS du dépôt, dans /usr/local/bin/eldaria-deployer (voir DEPLOIEMENT.md),
# et la clé de déploiement ne peut lancer que lui (« commande forcée » dans authorized_keys).
# Un commit ne peut donc pas modifier ce que la clé a le droit d'exécuter.
# Il ne prend aucun argument : ce que GitHub envoie d'autre est ignoré.
set -euo pipefail

DEPOT=/opt/eldaria
cd "$DEPOT"

# Un seul déploiement à la fois, même si deux pushs arrivent coup sur coup.
exec 9>/tmp/eldaria-deploiement.verrou
flock -n 9 || { echo "Un déploiement est déjà en cours."; exit 1; }

echo "Récupération du code…"
git fetch --quiet origin main
# --ff-only : refuse si le serveur a des modifications locales, au lieu de les écraser en silence.
git merge --ff-only --quiet origin/main

echo "Construction et redémarrage des conteneurs…"
docker compose up -d --build --remove-orphans --wait

# Les anciennes images inutilisées occupent vite des Go sur un petit VPS.
docker image prune -f > /dev/null

echo "Déployé : $(git log -1 --format='%h %s')"
