import { estMj, estProprietaire } from '../api/droits.js'

/**
 * Les liens d'une campagne, dans l'ordre de la barre du haut (sauf ceux marqués `enHaut: false`). Sur téléphone, ceux marqués `enBas`
 * vont dans la barre du bas (avec leur nom court et leur icône) ; les autres passent dans « Plus ».
 */
export function liensDuPortail(campagne) {
  const params = { id: campagne.id }
  const mj = estMj(campagne)
  const liens = [
    { cle: 'carte', nom: 'Carte', court: 'Carte', icone: 'carte', to: { name: 'carte', params }, routes: ['carte'], enBas: true },
    // Pas dans la barre du haut (l'arborescence ne change pas) : on y va par la cloche, ou par « Plus » sur téléphone.
    { cle: 'nouveautes', nom: 'Quoi de neuf', to: { name: 'nouveautes', params }, routes: ['nouveautes'], enHaut: false },
    { cle: 'seances', nom: 'Séances', to: { name: 'seances', params }, routes: ['seances'] },
    { cle: 'calendrier', nom: 'Calendrier', to: { name: 'calendrier', params }, routes: ['calendrier'] },
    { cle: 'bibliotheque', nom: 'Bibliothèque', court: 'Biblio', icone: 'livres', to: { name: 'bibliotheque', params }, bibliotheque: true, enBas: true },
    mj
      ? { cle: 'personnages', nom: 'Personnages', court: 'Persos', icone: 'personne', to: { name: 'personnages', params }, routes: ['personnages', 'fiche-personnage'], enBas: true }
      : { cle: 'personnage', nom: 'Ma fiche', court: 'Ma fiche', icone: 'personne', to: { name: 'personnage', params }, routes: ['personnage'], enBas: true },
    { cle: 'butins', nom: 'Butins', court: 'Butins', icone: 'coffre', to: { name: 'butins', params }, routes: ['butins'], enBas: true },
  ]
  if (mj) liens.push({ cle: 'mj', nom: 'Table du MJ', to: { name: 'mj', params }, routes: ['mj'] })
  if (estProprietaire(campagne)) liens.push({ cle: 'membres', nom: 'Membres', to: { name: 'membres', params }, routes: ['membres'] })
  return liens
}

/** Le lien de la page ouverte ; toutes les rubriques de la bibliothèque comptent pour « Bibliothèque ». */
export function estActif(lien, route) {
  if (lien.bibliotheque) return Boolean(route.meta?.bibliotheque)
  return lien.routes.includes(route.name)
}
