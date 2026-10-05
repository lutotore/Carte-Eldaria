import { DATE_DE_DEPART, erreurEvenement, estJourValide, FETES, formater, souffleDe } from '../../../src/domain/calendrier.js'
import { erreurs } from '../domaine/erreurs.js'
import { estMj } from '../domaine/roles.js'
import { transaction } from '../infra/base.js'
import { creerDepotsCalendrier } from '../infra/depotsCalendrier.js'
import { creerDepotsPlanning } from '../infra/depotsPlanning.js'

/** Ce que chaque type d'entrée accepte comme visibilité. Les notes appartiennent aux joueurs, le reste aux MJ. */
const VISIBILITES = { fete: ['cache', 'groupe'], evenement: ['cache', 'groupe'], chronique: ['cache', 'groupe'], note: ['privee', 'groupe'] }
const LONGUEUR_LIBELLE = 120

/**
 * Le calendrier du monde : la date du jour en jeu, la date butoir de la catastrophe (secrète tant que le MJ le veut),
 * les fêtes, les événements, la chronique des séances et les notes des joueurs.
 */
export function creerCalendrier({ db, depots, maintenant }) {
  const cal = creerDepotsCalendrier(db)
  const notifications = creerDepotsPlanning(db).notifications
  const iso = () => maintenant().toISOString()

  function exiger(condition, erreur) {
    if (!condition) throw erreur
  }
  const roleDans = (utilisateurId, campagneId) => depots.participations.role(utilisateurId, campagneId)
  const joueursDe = (campagneId) => depots.participations.membresDe(campagneId).filter((m) => !estMj(m.role))

  function exigerMembre(demandeurId, campagneId) {
    const role = roleDans(demandeurId, campagneId)
    exiger(role, erreurs.interdit())
    return role
  }

  function exigerMj(demandeurId, campagneId) {
    exiger(estMj(roleDans(demandeurId, campagneId)), erreurs.interdit())
  }

  /** Le calendrier de la campagne ; créé au premier besoin, à la date de départ et avec les fêtes connues de tous. */
  function assurer(campagneId) {
    const existant = cal.calendriers.lire(campagneId)
    if (existant) return existant
    transaction(db, () => {
      cal.calendriers.creer(campagneId, DATE_DE_DEPART, iso())
      for (const fete of FETES) cal.evenements.creer({ campagneId, type: 'fete', ...fete, visibilite: 'groupe', le: iso() })
    })
    return cal.calendriers.lire(campagneId)
  }

  const visible = (evenement, demandeurId, pourMj) => (
    pourMj || evenement.visibilite === 'groupe' || evenement.auteurId === demandeurId)

  /** Les champs d'une entrée, vérifiés ; le type décide qui peut l'écrire et quelles visibilités sont permises. */
  function lireEntree({ type, jour, duree = 1, annuel = false, titre, description = '', visibilite }) {
    exiger(Object.hasOwn(VISIBILITES, String(type)), erreurs.requeteInvalide('Type d’entrée inconnu.'))
    exiger(VISIBILITES[type].includes(visibilite), erreurs.requeteInvalide('Visibilité impossible pour ce type d’entrée.'))
    const entree = { type, jour, duree, annuel, titre: String(titre ?? '').trim(), description: String(description ?? ''), visibilite }
    const probleme = erreurEvenement(entree)
    exiger(!probleme, erreurs.requeteInvalide(probleme))
    return entree
  }

  function exigerDroitDEcrire(type, demandeurId, campagneId) {
    const role = exigerMembre(demandeurId, campagneId)
    exiger(type === 'note' || estMj(role), erreurs.interdit())
  }

  /** L'entrée, si le demandeur peut la modifier : son auteur pour une note, un MJ pour le reste. */
  function exigerModifiable(evenementId, demandeurId, campagneId) {
    const role = exigerMembre(demandeurId, campagneId)
    const evenement = cal.evenements.parId(evenementId, campagneId)
    const modifiable = evenement && (evenement.type === 'note' ? evenement.auteurId === demandeurId : estMj(role))
    exiger(modifiable, erreurs.introuvable('Événement'))
    return evenement
  }

  /** Une entrée du MJ qui devient visible des joueurs : ils sont prévenus. */
  function annoncer(campagneId, avant, apres) {
    if (apres.type === 'note' || apres.visibilite !== 'groupe' || avant?.visibilite === 'groupe') return
    for (const joueur of joueursDe(campagneId)) {
      notifications.creer({
        utilisateurId: joueur.id, campagneId, texte: `Calendrier : ${apres.titre}, le ${formater(apres.jour)}.`,
        lien: `/campagne/${campagneId}/calendrier`, categorie: 'revelations', creeLe: iso(),
      })
    }
  }

  return {
    calendrier({ demandeurId, campagneId }) {
      const pourMj = estMj(exigerMembre(demandeurId, campagneId))
      const { aujourdhui, butoir, butoirLibelle, butoirRevele } = assurer(campagneId)
      const butoirVisible = butoir !== null && (pourMj || butoirRevele)
      return {
        estMj: pourMj,
        aujourdhui,
        butoir: butoirVisible
          ? { jour: butoir, libelle: butoirLibelle, ...(pourMj ? { revele: butoirRevele } : {}), joursRestants: butoir - aujourdhui }
          : null,
        evenements: cal.evenements.deLaCampagne(campagneId)
          .filter((e) => visible(e, demandeurId, pourMj))
          .map(({ auteurId, ...e }) => ({ ...e, mienne: auteurId === demandeurId })),
      }
    },

    /** Pour la carte : la date du jour, lisible. N'écrit rien. */
    dateDuJour(campagneId) {
      const jour = cal.calendriers.lire(campagneId)?.aujourdhui ?? DATE_DE_DEPART
      return { jour, texte: formater(jour), souffle: souffleDe(jour).nom }
    },

    changerDate({ demandeurId, campagneId, jour }) {
      exigerMj(demandeurId, campagneId)
      exiger(estJourValide(jour), erreurs.requeteInvalide('Date invalide.'))
      assurer(campagneId)
      cal.calendriers.changerDate(campagneId, jour, iso())
    },

    /** La date butoir de la catastrophe : `jour` null l'efface. La révéler prévient les joueurs. */
    changerButoir({ demandeurId, campagneId, jour, libelle, revele }) {
      exigerMj(demandeurId, campagneId)
      exiger(jour === null || estJourValide(jour), erreurs.requeteInvalide('Date invalide.'))
      const nom = String(libelle ?? '').trim()
      exiger(nom && nom.length <= LONGUEUR_LIBELLE, erreurs.requeteInvalide(`Donne un nom à la date butoir (${LONGUEUR_LIBELLE} caractères au plus).`))
      exiger(typeof revele === 'boolean', erreurs.requeteInvalide('Indique si la date butoir est révélée.'))
      const avant = assurer(campagneId)
      transaction(db, () => {
        cal.calendriers.changerButoir(campagneId, { jour, libelle: nom, revele }, iso())
        const devientVisible = jour !== null && revele && !(avant.butoirRevele && avant.butoir !== null)
        if (!devientVisible) return
        for (const joueur of joueursDe(campagneId)) {
          notifications.creer({
            utilisateurId: joueur.id, campagneId, texte: `${nom} : ${formater(jour)}.`, lien: `/campagne/${campagneId}/calendrier`, categorie: 'revelations', creeLe: iso(),
          })
        }
      })
    },

    creerEvenement({ demandeurId, campagneId, ...demande }) {
      const entree = lireEntree(demande)
      exigerDroitDEcrire(entree.type, demandeurId, campagneId)
      assurer(campagneId)
      return transaction(db, () => {
        const evenementId = cal.evenements.creer({ campagneId, ...entree, auteurId: entree.type === 'note' ? demandeurId : null, le: iso() })
        annoncer(campagneId, null, entree)
        return { evenementId }
      })
    },

    modifierEvenement({ demandeurId, campagneId, evenementId, ...demande }) {
      const avant = exigerModifiable(evenementId, demandeurId, campagneId)
      const entree = lireEntree(demande)
      // Une note reste une note, et une entrée du MJ ne devient pas une note.
      exiger((entree.type === 'note') === (avant.type === 'note'), erreurs.requeteInvalide('Le type de cette entrée ne peut pas changer ainsi.'))
      transaction(db, () => {
        cal.evenements.modifier(avant.id, entree, iso())
        annoncer(campagneId, avant, entree)
      })
    },

    supprimerEvenement({ demandeurId, campagneId, evenementId }) {
      cal.evenements.supprimer(exigerModifiable(evenementId, demandeurId, campagneId).id)
    },

    /** Un membre retiré de la campagne n'y laisse pas ses notes. */
    oublierNotesCalendrierDe(utilisateurId, campagneId) {
      cal.evenements.supprimerNotesDe(utilisateurId, campagneId)
    },

    /** Part de l'export RGPD : les notes écrites dans le calendrier. */
    donneesCalendrierDe(utilisateurId) {
      return {
        calendrier: cal.evenements.notesDe(utilisateurId).map(({ jour, ...note }) => ({
          campagne: note.campagne, date: formater(jour), titre: note.titre, description: note.description, visibilite: note.visibilite, creeLe: note.creeLe,
        })),
      }
    },
  }
}
