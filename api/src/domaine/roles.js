/** Rôle d'un utilisateur dans une campagne donnée (un même compte peut avoir des rôles différents ailleurs). */
export const ROLES = ['proprietaire', 'mj', 'joueur', 'occasionnel']

/** Le propriétaire est créé en ligne de commande : on ne l'invite pas. */
export const ROLES_INVITABLES = ['mj', 'joueur', 'occasionnel']

/** Voit et modifie toute la vérité de la campagne. */
export const estMj = (role) => role === 'proprietaire' || role === 'mj'

/** Invite, retire des membres et réinitialise leurs mots de passe. */
export const peutGererMembres = (role) => role === 'proprietaire'

/** Seuls les joueurs réguliers répondent aux sondages de dates ; les occasionnels ne les voient pas. */
export const repondAuxSondages = (role) => role === 'joueur'
export const voitLesSondages = (role) => estMj(role) || repondAuxSondages(role)
