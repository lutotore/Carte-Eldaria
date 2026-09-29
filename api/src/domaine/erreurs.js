/**
 * Erreur prévue par les règles du portail. Le `code` est stable (le front et les tests s'en servent),
 * le message est lisible par un humain et peut être affiché tel quel.
 */
export class ErreurMetier extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ErreurMetier'
    this.code = code
  }
}

export const erreurs = {
  requeteInvalide: (message) => new ErreurMetier('requete_invalide', message),
  interdit: () => new ErreurMetier('interdit', "Tu n'as pas les droits pour faire ça."),
  introuvable: (quoi = 'Élément') => new ErreurMetier('introuvable', `${quoi} introuvable.`),
  mondeAbsent: () => new ErreurMetier('introuvable', "Le monde de cette campagne n'a pas encore été importé par le MJ."),
  identifiantsIncorrects: () => new ErreurMetier('identifiants_incorrects', 'Identifiant ou mot de passe incorrect.'),
  identifiantPris: () => new ErreurMetier('identifiant_pris', 'Cet identifiant est déjà pris.'),
  dejaMembre: () => new ErreurMetier('deja_membre', 'Ce compte fait déjà partie de la campagne.'),
  lien: (etat) => {
    const messages = {
      inconnu: "Ce lien n'existe pas. Vérifie qu'il a été copié en entier.",
      utilise: 'Ce lien a déjà servi. Demande-en un nouveau au MJ.',
      expire: 'Ce lien a expiré. Demande-en un nouveau au MJ.',
    }
    return new ErreurMetier(`lien_${etat}`, messages[etat])
  },
}
