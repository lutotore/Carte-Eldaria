import { decrireSeance } from '../../../src/domain/agenda.js'
import {
  classerDates, creneauCommun, enHeure, erreurJour, jourAParis, lirePlage, MAX_DATES,
} from '../../../src/domain/planning.js'
import { erreurs } from '../domaine/erreurs.js'
import { estMj, repondAuxSondages, voitLesSondages } from '../domaine/roles.js'
import { transaction } from '../infra/base.js'
import { creerDepotsPlanning } from '../infra/depotsPlanning.js'

const JOUR_MS = 86_400_000
const LONGUEUR_MAX_LIEU = 120
const NOTIFICATIONS_AFFICHEES = 20
/** Durées de conservation : à garder alignées sur src/legal.js (politique de confidentialité). */
export const CONSERVATION_JOURS = { reponses: 30, notificationsLues: 30, notifications: 90 }

/**
 * Cas d'usage de la planification : sondages de dates, réponses des joueurs, séance fixée, notifications.
 * Comme pour le reste du portail, chaque méthode vérifie elle-même les droits du demandeur.
 */
export function creerPlanning({ db, depots, maintenant }) {
  const planning = creerDepotsPlanning(db)
  const iso = () => maintenant().toISOString()
  const aujourdHui = () => jourAParis(maintenant())

  function exiger(condition, erreur) {
    if (!condition) throw erreur
  }

  const roleDans = (utilisateurId, campagneId) => depots.participations.role(utilisateurId, campagneId)

  function exigerMj(demandeurId, campagneId) {
    exiger(estMj(roleDans(demandeurId, campagneId)), erreurs.interdit())
  }

  function exigerSondageOuvert(sondageId, campagneId) {
    const sondage = planning.sondages.parId(sondageId, campagneId)
    exiger(sondage, erreurs.introuvable('Sondage'))
    exiger(sondage.statut === 'ouvert', erreurs.requeteInvalide('Ce sondage est déjà fermé.'))
    return sondage
  }

  function lirePlageOuErreur(reponse) {
    const plage = lirePlage(reponse)
    exiger(plage, erreurs.requeteInvalide('Indique une plage horaire valide (heure de début et de fin, au format HH:MM).'))
    return plage
  }

  /** Prévient les membres choisis ; `lien` mène à la page concernée du portail. */
  function notifier(campagneId, destinataires, texte) {
    const lien = `/campagne/${campagneId}/seances`
    for (const membre of destinataires) {
      planning.notifications.creer({ utilisateurId: membre.id, campagneId, texte, lien, creeLe: iso() })
    }
  }

  const membres = (campagneId) => depots.participations.membresDe(campagneId)
  const joueursDe = (campagneId) => membres(campagneId).filter((m) => repondAuxSondages(m.role))
  const tousSauf = (campagneId, demandeurId) => membres(campagneId).filter((m) => m.id !== demandeurId)
  const campagneNom = (campagneId) => depots.campagnes.parId(campagneId).nom

  const reponsesOuvertes = (sondage) => !sondage.dateLimite || aujourdHui() <= sondage.dateLimite

  function synthese(sondage, campagneId) {
    const reponses = planning.disponibilites.duSondage(sondage.id)
    const dates = planning.sondages.dates(sondage.id).map(({ id, jour }) => {
      const pourCetteDate = reponses.filter((r) => r.dateId === id).map((r) => ({
        utilisateurId: r.utilisateurId,
        identifiant: r.identifiant,
        disponible: r.disponible === 1,
        debut: r.debut,
        fin: r.fin,
      }))
      const plages = pourCetteDate.filter((r) => r.disponible)
      return { id, jour, reponses: pourCetteDate, disponibles: plages.length, creneau: creneauCommun(plages) }
    })
    const meilleure = classerDates(dates.filter((d) => d.disponibles > 0))[0]
    return {
      id: sondage.id,
      lieu: sondage.lieu,
      dateLimite: sondage.dateLimite,
      ouvertAuxReponses: reponsesOuvertes(sondage),
      joueurs: joueursDe(campagneId).map(({ id, identifiant }) => ({ id, identifiant })),
      dates,
      meilleureDateId: meilleure?.id ?? null,
    }
  }

  return {
    /** Ce que la page « Séances » affiche : prochaine séance et sondage en cours (sauf pour les occasionnels). */
    planning({ demandeurId, campagneId }) {
      const role = roleDans(demandeurId, campagneId)
      exiger(role, erreurs.interdit())
      const sondage = voitLesSondages(role) ? planning.sondages.ouvertDe(campagneId) : null
      return {
        campagne: campagneNom(campagneId),
        prochaineSeance: planning.seances.prochaine(campagneId, aujourdHui()) ?? null,
        sondage: sondage ? synthese(sondage, campagneId) : null,
      }
    },

    ouvrirSondage({ demandeurId, campagneId, dates, lieu = '', dateLimite = null }) {
      exigerMj(demandeurId, campagneId)
      exiger(Array.isArray(dates) && dates.length > 0 && dates.length <= MAX_DATES,
        erreurs.requeteInvalide(`Propose entre 1 et ${MAX_DATES} dates.`))
      exiger(new Set(dates).size === dates.length, erreurs.requeteInvalide('La même date est proposée deux fois.'))
      for (const jour of dates) {
        const probleme = erreurJour(jour, aujourdHui())
        exiger(!probleme, erreurs.requeteInvalide(probleme))
      }
      if (dateLimite) {
        const probleme = erreurJour(dateLimite, aujourdHui())
        exiger(!probleme, erreurs.requeteInvalide(`Date limite : ${probleme}`))
      }
      exiger(lieu == null || typeof lieu === 'string', erreurs.requeteInvalide('Le lieu doit être un texte.'))
      const lieuPropre = (lieu ?? '').trim()
      exiger(lieuPropre.length <= LONGUEUR_MAX_LIEU, erreurs.requeteInvalide(`Le lieu ne peut pas dépasser ${LONGUEUR_MAX_LIEU} caractères.`))
      exiger(!planning.sondages.ouvertDe(campagneId), erreurs.requeteInvalide('Un sondage est déjà ouvert : fixe la séance ou annule-le avant d’en ouvrir un autre.'))

      return transaction(db, () => {
        const sondageId = planning.sondages.creer({ campagneId, lieu: lieuPropre, dateLimite: dateLimite || null, creeLe: iso() })
        for (const jour of [...dates].sort()) planning.sondages.ajouterDate(sondageId, jour)
        const nombre = dates.length > 1 ? `${dates.length} dates proposées` : '1 date proposée'
        notifier(campagneId, joueursDe(campagneId), `Nouveau sondage : ${nombre} pour la prochaine séance.`)
        return { sondageId }
      })
    },

    repondre({ demandeurId, campagneId, sondageId, reponses }) {
      exiger(repondAuxSondages(roleDans(demandeurId, campagneId)), erreurs.interdit())
      const sondage = exigerSondageOuvert(sondageId, campagneId)
      exiger(reponsesOuvertes(sondage), erreurs.requeteInvalide('La date limite pour répondre est passée.'))
      exiger(Array.isArray(reponses) && reponses.length > 0, erreurs.requeteInvalide('Aucune réponse reçue.'))
      const datesDuSondage = new Set(planning.sondages.dates(sondage.id).map((d) => d.id))

      const aEnregistrer = reponses.map((reponse) => {
        exiger(datesDuSondage.has(reponse?.dateId), erreurs.requeteInvalide("Cette date ne fait pas partie du sondage."))
        exiger(typeof reponse.disponible === 'boolean', erreurs.requeteInvalide('Réponds par oui ou par non pour chaque date.'))
        const plage = reponse.disponible ? lirePlageOuErreur(reponse) : { debut: null, fin: null }
        return { dateId: reponse.dateId, utilisateurId: demandeurId, disponible: reponse.disponible, ...plage, reponduLe: iso() }
      })
      transaction(db, () => aEnregistrer.forEach((r) => planning.disponibilites.enregistrer(r)))
    },

    fixerSeance({ demandeurId, campagneId, sondageId, dateId, debut, fin, lieu }) {
      exigerMj(demandeurId, campagneId)
      const sondage = exigerSondageOuvert(sondageId, campagneId)
      const date = planning.sondages.dates(sondage.id).find((d) => d.id === dateId)
      exiger(date, erreurs.requeteInvalide("Cette date ne fait pas partie du sondage."))
      const plage = lirePlageOuErreur({ debut, fin })
      exiger(lieu == null || typeof lieu === 'string', erreurs.requeteInvalide('Le lieu doit être un texte.'))
      const lieuFinal = lieu == null ? sondage.lieu : lieu.trim()
      exiger(lieuFinal.length <= LONGUEUR_MAX_LIEU, erreurs.requeteInvalide(`Le lieu ne peut pas dépasser ${LONGUEUR_MAX_LIEU} caractères.`))

      return transaction(db, () => {
        const seance = { jour: date.jour, ...plage, lieu: lieuFinal }
        const seanceId = planning.seances.creer({ campagneId, ...seance, fixeeLe: iso() })
        planning.sondages.changerStatut(sondage.id, 'clos')
        notifier(campagneId, tousSauf(campagneId, demandeurId), `Séance fixée : ${decrireSeance(seance)}.`)
        return { seanceId }
      })
    },

    annulerSondage({ demandeurId, campagneId, sondageId }) {
      exigerMj(demandeurId, campagneId)
      const sondage = exigerSondageOuvert(sondageId, campagneId)
      transaction(db, () => {
        planning.sondages.changerStatut(sondage.id, 'annule')
        notifier(campagneId, joueursDe(campagneId), 'Le sondage de dates a été annulé.')
      })
    },

    annulerSeance({ demandeurId, campagneId, seanceId }) {
      exigerMj(demandeurId, campagneId)
      const seance = planning.seances.parId(seanceId, campagneId)
      exiger(seance && seance.statut === 'prevue', erreurs.introuvable('Séance'))
      transaction(db, () => {
        planning.seances.annuler(seance.id)
        notifier(campagneId, tousSauf(campagneId, demandeurId), `Séance annulée : ${decrireSeance(seance)}.`)
      })
    },

    notifications({ demandeurId }) {
      const liste = planning.notifications.de(demandeurId, NOTIFICATIONS_AFFICHEES)
        .map(({ lueLe, ...reste }) => ({ ...reste, lue: Boolean(lueLe) }))
      return { nonLues: planning.notifications.nonLues(demandeurId), liste }
    },

    marquerNotificationsLues({ demandeurId }) {
      planning.notifications.marquerLues(demandeurId, iso())
    },

    /** Un membre retiré n'a plus à recevoir, ni à garder, les messages de cette campagne. */
    oublierNotificationsDe(utilisateurId, campagneId) {
      planning.notifications.supprimerCellesDe(utilisateurId, campagneId)
    },

    /** Part de l'export RGPD qui concerne la planification. */
    donneesPlanningDe(utilisateurId) {
      return {
        disponibilites: planning.disponibilites.de(utilisateurId).map((r) => ({
          campagne: r.campagne,
          jour: r.jour,
          disponible: r.disponible === 1,
          debut: r.debut === null ? null : enHeure(r.debut),
          fin: r.fin === null ? null : enHeure(r.fin),
          reponduLe: r.reponduLe,
        })),
        notifications: planning.notifications.de(utilisateurId, 1000)
          .map(({ texte, creeLe, lueLe }) => ({ texte, creeLe, lue: Boolean(lueLe) })),
      }
    },

    purgerPlanning() {
      const il = (jours) => new Date(maintenant().getTime() - jours * JOUR_MS)
      return planning.purger({
        jourLimiteSondages: jourAParis(il(CONSERVATION_JOURS.reponses)),
        luesAvant: il(CONSERVATION_JOURS.notificationsLues).toISOString(),
        toutesAvant: il(CONSERVATION_JOURS.notifications).toISOString(),
      })
    },
  }
}
