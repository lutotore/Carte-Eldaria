#!/usr/bin/env node
/**
 * Publie le relevé de la session : versionne public/monde.json et pousse sur GitHub.
 * Le déploiement GitHub Pages se lance ensuite tout seul.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()

const monde = JSON.parse(readFileSync(new URL('../public/monde.json', import.meta.url), 'utf8'))
const aPublier = git('status', '--porcelain', 'public/monde.json')

if (!aPublier) {
  console.log('Rien de nouveau à publier : la carte des joueurs est déjà à jour.')
  process.exit(0)
}

git('add', 'public/monde.json')
git('commit', '-m', `Relevé : ${monde.session}`)
git('push')
console.log(`Relevé « ${monde.session} » publié. La carte sera en ligne d'ici une minute ou deux.`)
