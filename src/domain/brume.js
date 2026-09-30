/**
 * Altitude du haut de la mer de brume pour une valeur d'Horloge donnée.
 * La brume reste à sa hauteur de base, puis monte d'un pas par point
 * à partir du seuil `monteeDes`.
 */
export function niveauBrume(horloge, { base, monteeDes, pas }) {
  if (horloge < monteeDes) return base
  return base + (horloge - monteeDes + 1) * pas
}
