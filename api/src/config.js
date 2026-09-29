/** Réglages lus dans l'environnement (fichier .env à côté du docker-compose.yml). */
export function lireConfig(env = process.env) {
  const origine = String(env.ORIGINE ?? '').replace(/\/+$/, '')
  if (!/^https?:\/\/[^/]+$/.test(origine)) {
    throw new Error('ORIGINE manquante ou invalide : indique l’adresse publique du site, par exemple https://eldaria.mondomaine.fr')
  }
  return {
    origine,
    cheminBase: env.BASE ?? '/donnees/eldaria.db',
    port: Number(env.PORT ?? 3000),
    hote: env.HOTE ?? '0.0.0.0',
    cookieSecurise: origine.startsWith('https://'),
    derriereProxy: env.DERRIERE_PROXY !== '0',
    journal: env.JOURNAL !== '0',
  }
}
