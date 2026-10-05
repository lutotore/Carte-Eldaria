import { versPublic } from '../../../src/domain/projection.js'
import { erreurs } from '../domaine/erreurs.js'
import { estUnEtatValide } from '../domaine/etat.js'
import { erreurIdentifiant, erreurMotDePasse } from '../domaine/identifiants.js'
import { etatDuLien, expirationDans } from '../domaine/liens.js'
import { estMj, peutGererMembres, ROLES_INVITABLES } from '../domaine/roles.js'
import { creerDepots } from '../infra/depots.js'
import { transaction } from '../infra/base.js'
import { empreinteJeton, genererJeton } from '../securite/jetons.js'
import { hacherMotDePasse, verifierMotDePasse } from '../securite/motsDePasse.js'
import { creerBibliotheque } from './bibliotheque.js'
import { creerPersonnages } from './personnages.js'
import { creerPlanning } from './planning.js'

export const DUREES_JOURS = { invitation: 7, reinitialisation: 2, session: 30 }

/**
 * Cas d'usage du portail. Chaque méthode vérifie elle-même les droits du demandeur :
 * la couche HTTP ne fait que traduire, elle ne décide de rien.
 */
export function creerPortail({ db, maintenant = () => new Date(), coutMotDePasse = {}, images }) {
  const depots = creerDepots(db)
  const planningDeLaCampagne = creerPlanning({ db, depots, maintenant })
  const bibliothequeDeLaCampagne = creerBibliotheque({ db, depots, maintenant, images })
  const personnagesDeLaCampagne = creerPersonnages({ db, depots, maintenant, bibliotheque: bibliothequeDeLaCampagne })
  const iso = () => maintenant().toISOString()
  const hacher = (motDePasse) => hacherMotDePasse(motDePasse, coutMotDePasse)

  // Empreinte factice : un identifiant inconnu coûte autant de temps qu'un mauvais mot de passe.
  let empreinteLeurre = null
  const leurre = async () => (empreinteLeurre ??= await hacher('leurre-pour-temps-constant'))

  function exiger(condition, erreur) {
    if (!condition) throw erreur
  }

  function roleDans(utilisateurId, campagneId) {
    return depots.participations.role(utilisateurId, campagneId)
  }

  function exigerProprietaire(demandeurId, campagneId) {
    exiger(peutGererMembres(roleDans(demandeurId, campagneId)), erreurs.interdit())
  }

  function exigerLienValide(lien) {
    const etat = etatDuLien(lien, maintenant())
    exiger(etat === 'valide', erreurs.lien(etat))
    return lien
  }

  function validerNouveauCompte({ identifiant, motDePasse }) {
    const probleme = erreurIdentifiant(identifiant) ?? erreurMotDePasse(motDePasse)
    exiger(!probleme, erreurs.requeteInvalide(probleme))
  }

  function emettreReinitialisation(utilisateurId) {
    const jeton = genererJeton()
    const expireLe = expirationDans(maintenant(), DUREES_JOURS.reinitialisation).toISOString()
    depots.reinitialisations.creer({ utilisateurId, empreinte: empreinteJeton(jeton), expireLe, creeLe: iso() })
    return { jeton, expireLe }
  }

  function lireEtatVersionne(campagneId) {
    const ligne = depots.etats.lire(campagneId)
    exiger(ligne, erreurs.mondeAbsent())
    return { etat: JSON.parse(ligne.contenu), version: ligne.version }
  }

  const lireEtatBrut = (campagneId) => lireEtatVersionne(campagneId).etat

  function exigerEtatValide(etat) {
    exiger(estUnEtatValide(etat), erreurs.requeteInvalide("État du monde incomplet : rien n'a été écrit."))
  }

  async function exigerMotDePasseActuel(utilisateurId, motDePasse) {
    const utilisateur = depots.utilisateurs.parId(utilisateurId)
    exiger(utilisateur, erreurs.introuvable('Compte'))
    exiger(await verifierMotDePasse(String(motDePasse ?? ''), utilisateur.empreinte_mdp), erreurs.identifiantsIncorrects())
  }

  function emettreInvitation(campagneId, role) {
    const jeton = genererJeton()
    const expireLe = expirationDans(maintenant(), DUREES_JOURS.invitation).toISOString()
    depots.invitations.creer({ campagneId, role, empreinte: empreinteJeton(jeton), expireLe, creeLe: iso() })
    return { jeton, expireLe }
  }

  return {
    // --- Story 1 : campagne (lancée en ligne de commande sur le serveur) ---
    initialiserCampagne({ nom }) {
      const propre = String(nom ?? '').trim()
      exiger(propre.length > 0 && propre.length <= 80, erreurs.requeteInvalide('La campagne doit avoir un nom (80 caractères au plus).'))
      return transaction(db, () => {
        const campagneId = depots.campagnes.creer({ nom: propre, creeLe: iso() })
        return { campagneId, ...emettreInvitation(campagneId, 'proprietaire') }
      })
    },

    // --- Story 2 : invitation ---
    creerInvitation({ demandeurId, campagneId, role }) {
      exigerProprietaire(demandeurId, campagneId)
      exiger(ROLES_INVITABLES.includes(role), erreurs.requeteInvalide(`Rôle à choisir parmi : ${ROLES_INVITABLES.join(', ')}.`))
      return emettreInvitation(campagneId, role)
    },

    decrireInvitation(jeton) {
      const invitation = exigerLienValide(depots.invitations.parEmpreinte(empreinteJeton(jeton)))
      return { campagne: invitation.campagne, role: invitation.role }
    },

    // --- Story 3 : acceptation, avec un nouveau compte ou un compte existant ---
    async accepterInvitation(jeton, { identifiant, motDePasse, utilisateurId }) {
      const empreinte = empreinteJeton(jeton)
      exigerLienValide(depots.invitations.parEmpreinte(empreinte))
      const nouveauCompte = utilisateurId === undefined
      if (nouveauCompte) validerNouveauCompte({ identifiant, motDePasse })
      const empreinteMdp = nouveauCompte ? await hacher(motDePasse) : null

      // Tout se joue d'un bloc, après le hachage : deux clics simultanés ne peuvent pas utiliser le même lien.
      return transaction(db, () => {
        const invitation = exigerLienValide(depots.invitations.parEmpreinte(empreinte))
        let id = utilisateurId
        if (nouveauCompte) {
          exiger(!depots.utilisateurs.parIdentifiant(identifiant), erreurs.identifiantPris())
          id = depots.utilisateurs.creer({ identifiant, empreinteMdp, creeLe: iso() })
        } else {
          exiger(depots.utilisateurs.parId(id), erreurs.introuvable('Compte'))
          exiger(!roleDans(id, invitation.campagneId), erreurs.dejaMembre())
        }
        depots.participations.ajouter({ utilisateurId: id, campagneId: invitation.campagneId, role: invitation.role, rejointLe: iso() })
        depots.invitations.marquerUtilisee(invitation.id, iso())
        return { utilisateurId: id, campagneId: invitation.campagneId }
      })
    },

    // --- Story 4 : sessions ---
    async connecter({ identifiant, motDePasse }) {
      const utilisateur = typeof identifiant === 'string' ? depots.utilisateurs.parIdentifiant(identifiant) : undefined
      const correct = await verifierMotDePasse(String(motDePasse ?? ''), utilisateur?.empreinte_mdp ?? await leurre())
      exiger(utilisateur && correct, erreurs.identifiantsIncorrects())
      const jeton = genererJeton()
      const expireLe = expirationDans(maintenant(), DUREES_JOURS.session).toISOString()
      depots.sessions.creer({ empreinte: empreinteJeton(jeton), utilisateurId: utilisateur.id, expireLe, creeLe: iso() })
      return { jeton, expireLe }
    },

    utilisateurDeSession(jeton) {
      if (!jeton) return null
      const utilisateur = depots.sessions.utilisateurValide(empreinteJeton(jeton), iso())
      return utilisateur ? { id: utilisateur.id, identifiant: utilisateur.identifiant } : null
    },

    deconnecter(jeton) {
      if (jeton) depots.sessions.supprimer(empreinteJeton(jeton))
    },

    profil(utilisateurId) {
      const utilisateur = depots.utilisateurs.parId(utilisateurId)
      exiger(utilisateur, erreurs.introuvable('Compte'))
      const campagnes = depots.participations.campagnesDe(utilisateurId).map(({ id, nom, role }) => ({ id, nom, role }))
      return { id: utilisateur.id, identifiant: utilisateur.identifiant, campagnes }
    },

    // --- Story 5 : réinitialisation du mot de passe ---
    creerReinitialisation({ demandeurId, campagneId, cibleId }) {
      exigerProprietaire(demandeurId, campagneId)
      exiger(roleDans(cibleId, campagneId), erreurs.introuvable('Membre'))
      // Le mot de passe vaut pour tout le compte : le demandeur doit être propriétaire de TOUTES
      // les campagnes du membre, sinon il pourrait s'emparer d'un accès qu'il ne gère pas.
      const toutesSiennes = depots.participations.campagnesDe(cibleId).every((c) => peutGererMembres(roleDans(demandeurId, c.id)))
      exiger(toutesSiennes, erreurs.interdit())
      return emettreReinitialisation(cibleId)
    },

    /** Dépannage en ligne de commande, pour le propriétaire lui-même : aucun contrôle de rôle. */
    reinitialisationParAdministrateur({ identifiant }) {
      const utilisateur = depots.utilisateurs.parIdentifiant(identifiant)
      exiger(utilisateur, erreurs.introuvable('Compte'))
      return emettreReinitialisation(utilisateur.id)
    },

    decrireReinitialisation(jeton) {
      const lien = exigerLienValide(depots.reinitialisations.parEmpreinte(empreinteJeton(jeton)))
      return { identifiant: lien.identifiant }
    },

    async reinitialiser(jeton, motDePasse) {
      const empreinte = empreinteJeton(jeton)
      exigerLienValide(depots.reinitialisations.parEmpreinte(empreinte))
      const probleme = erreurMotDePasse(motDePasse)
      exiger(!probleme, erreurs.requeteInvalide(probleme))
      const empreinteMdp = await hacher(motDePasse)
      transaction(db, () => {
        const lien = exigerLienValide(depots.reinitialisations.parEmpreinte(empreinte))
        depots.utilisateurs.changerMotDePasse(lien.utilisateurId, empreinteMdp)
        depots.reinitialisations.marquerUtilisee(lien.id, iso())
        // Si le mot de passe a fuité, les sessions ouvertes avec lui doivent tomber aussi.
        depots.sessions.supprimerCellesDe(lien.utilisateurId)
      })
    },

    // --- Story 6 : membres ---
    membres({ demandeurId, campagneId }) {
      exiger(estMj(roleDans(demandeurId, campagneId)), erreurs.interdit())
      return depots.participations.membresDe(campagneId)
    },

    retirerMembre({ demandeurId, campagneId, cibleId }) {
      exigerProprietaire(demandeurId, campagneId)
      exiger(cibleId !== demandeurId, erreurs.requeteInvalide('Le propriétaire ne peut pas se retirer de sa propre campagne.'))
      exiger(roleDans(cibleId, campagneId), erreurs.introuvable('Membre'))
      transaction(db, () => {
        depots.participations.retirer(cibleId, campagneId)
        planningDeLaCampagne.oublierNotificationsDe(cibleId, campagneId)
        bibliothequeDeLaCampagne.oublierRevelationsDe(cibleId, campagneId)
        personnagesDeLaCampagne.oublierPersonnageDe(cibleId, campagneId)
      })
    },

    // --- Stories 7 et 8 : le monde de la campagne ---
    lireMonde({ demandeurId, campagneId }) {
      exiger(roleDans(demandeurId, campagneId), erreurs.interdit())
      return versPublic(lireEtatBrut(campagneId))
    },

    /** Renvoie le monde et son numéro de version, à rappeler lors de l'écriture. */
    lireEtat({ demandeurId, campagneId }) {
      exiger(estMj(roleDans(demandeurId, campagneId)), erreurs.interdit())
      return lireEtatVersionne(campagneId)
    },

    /**
     * Verrou optimiste : l'écriture ne passe que si personne n'a modifié le monde depuis la lecture.
     * Sinon, le second MJ est prévenu au lieu d'écraser en silence le travail du premier.
     */
    ecrireEtat({ demandeurId, campagneId, etat, versionAttendue }) {
      exiger(estMj(roleDans(demandeurId, campagneId)), erreurs.interdit())
      exiger(Number.isInteger(versionAttendue), erreurs.requeteInvalide("Version du monde manquante : rien n'a été écrit."))
      exigerEtatValide(etat)
      lireEtatVersionne(campagneId) // monde absent : message clair plutôt qu'un faux conflit
      const ecrit = depots.etats.remplacerSiVersion(campagneId, JSON.stringify(etat), iso(), versionAttendue)
      exiger(ecrit, erreurs.conflit())
      return { version: versionAttendue + 1 }
    },

    /** Reprise du fichier mj/etat.json (ligne de commande, sur le serveur). */
    importerEtat(campagneId, etat) {
      exiger(depots.campagnes.parId(campagneId), erreurs.introuvable('Campagne'))
      exigerEtatValide(etat)
      depots.etats.ecrire(campagneId, JSON.stringify(etat), iso())
    },

    /** Sauvegarde en ligne de commande. */
    etatPourAdministrateur(campagneId) {
      return { etat: lireEtatBrut(campagneId) }
    },

    // --- Droits RGPD sur son propre compte ---
    async changerMotDePasse({ utilisateurId, actuel, nouveau, jetonConserve }) {
      await exigerMotDePasseActuel(utilisateurId, actuel)
      const probleme = erreurMotDePasse(nouveau)
      exiger(!probleme, erreurs.requeteInvalide(probleme))
      const empreinteMdp = await hacher(nouveau)
      transaction(db, () => {
        depots.utilisateurs.changerMotDePasse(utilisateurId, empreinteMdp)
        depots.sessions.supprimerCellesDe(utilisateurId)
        if (jetonConserve) {
          const expireLe = expirationDans(maintenant(), DUREES_JOURS.session).toISOString()
          depots.sessions.creer({ empreinte: empreinteJeton(jetonConserve), utilisateurId, expireLe, creeLe: iso() })
        }
      })
    },

    exporterDonnees(utilisateurId) {
      const utilisateur = depots.utilisateurs.parId(utilisateurId)
      exiger(utilisateur, erreurs.introuvable('Compte'))
      return {
        exporteLe: iso(),
        compte: { identifiant: utilisateur.identifiant, creeLe: utilisateur.cree_le },
        campagnes: depots.participations.campagnesDe(utilisateurId).map(({ nom, role, rejointLe }) => ({ nom, role, rejointLe })),
        sessions: depots.sessions.resumeDe(utilisateurId),
        ...planningDeLaCampagne.donneesPlanningDe(utilisateurId),
        ...bibliothequeDeLaCampagne.donneesBibliothequeDe(utilisateurId),
        ...personnagesDeLaCampagne.donneesPersonnagesDe(utilisateurId),
      }
    },

    async supprimerCompte({ utilisateurId, motDePasse }) {
      await exigerMotDePasseActuel(utilisateurId, motDePasse)
      const possede = depots.participations.campagnesDe(utilisateurId).filter((c) => c.role === 'proprietaire')
      exiger(possede.length === 0, erreurs.requeteInvalide(
        `Tu es propriétaire de : ${possede.map((c) => c.nom).join(', ')}. Ce compte ne peut pas être supprimé tant que la campagne existe.`,
      ))
      // Les clés étrangères (ON DELETE CASCADE) emportent sessions, participations et liens.
      depots.utilisateurs.supprimer(utilisateurId)
    },

    purger() {
      return depots.purger(iso()) + planningDeLaCampagne.purgerPlanning()
    },

    // --- Lot 2 : planification des séances et notifications (voir services/planning.js) ---
    ...planningDeLaCampagne,

    // --- Lot 3 : bibliothèque de PNJ (voir services/bibliotheque.js) ---
    ...bibliothequeDeLaCampagne,

    // --- Fiches de personnage, inventaire, Marques du Rêve, butins (voir services/personnages.js) ---
    ...personnagesDeLaCampagne,

    /**
     * Import d'un fichier préparé (ligne de commande) : les fiches de la bibliothèque, puis les butins,
     * reliés aux objets du même nom. Les butins sont vérifiés avant d'écrire quoi que ce soit.
     */
    importerFiches(campagneId, donnees) {
      personnagesDeLaCampagne.verifierButinsImportes(donnees?.butins ?? [])
      const { nombre } = bibliothequeDeLaCampagne.importerFiches(campagneId, donnees)
      return { nombre, butins: personnagesDeLaCampagne.importerButins(campagneId, donnees?.butins ?? []) }
    },
  }
}
