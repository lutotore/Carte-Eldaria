/** Les sortes d'entrées du calendrier, leurs libellés et les visibilités permises. */
export const TYPES_ENTREE = {
  evenement: { nom: 'Événement', visibilites: ['cache', 'groupe'] },
  fete: { nom: 'Fête', visibilites: ['cache', 'groupe'] },
  chronique: { nom: 'Chronique de séance', visibilites: ['cache', 'groupe'] },
  note: { nom: 'Note', visibilites: ['privee', 'groupe'] },
}

export const VISIBILITES = {
  cache: 'Caché (MJ seulement)',
  groupe: 'Visible du groupe',
  privee: 'Privée (toi et les MJ)',
}
