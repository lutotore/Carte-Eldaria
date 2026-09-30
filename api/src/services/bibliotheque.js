import { randomUUID } from 'node:crypto'
import { noterCroyance } from '../../../src/domain/suivi.js'
import { erreurs } from '../domaine/erreurs.js'
import {
  erreurFacette, erreurNote, erreurTitreSecret, etatDeRevelation, FACETTES_PNJ, vueJoueur,
} from '../../../src/domain/fiches.js'
import { estMj } from '../domaine/roles.js'
import { transaction } from '../infra/base.js'
import { creerDepotsBibliotheque } from '../infra/depotsBibliotheque.js'
import { creerDepotsPlanning } from '../infra/depotsPlanning.js'

const TAILLE_MAX_IMAGE = 5 * 1024 * 1024
const LONGUEUR_MAX_NOTES_MJ = 20_000

/** Type d'image reconnu à ses premiers octets (on ne se fie jamais au nom ni au type annoncé). */
function typeImage(octets) {
  const debut = (...valeurs) => valeurs.every((v, i) => octets[i] === v)
  if (debut(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (debut(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (octets.subarray(0, 4).toString('latin1') === 'RIFF' && octets.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

/**
 * Cas d'usage de la bibliothèque : fiches de PNJ révélées morceau par morceau, portraits, notes et croyances.
 * Comme ailleurs, chaque méthode vérifie elle-même les droits du demandeur.
 */
export function creerBibliotheque({ db, depots, maintenant, images }) {
  const biblio = creerDepotsBibliotheque(db)
  const notifications = creerDepotsPlanning(db).notifications
  const iso = () => maintenant().toISOString()

  function exiger(condition, erreur) {
    if (!condition) throw erreur
  }
  const roleDans = (utilisateurId, campagneId) => depots.participations.role(utilisateurId, campagneId)
  const exigerMj = (demandeurId, campagneId) => exiger(estMj(roleDans(demandeurId, campagneId)), erreurs.interdit())
  const joueursDe = (campagneId) => depots.participations.membresDe(campagneId).filter((m) => !estMj(m.role))

  function exigerFiche(ficheId, campagneId) {
    const fiche = biblio.fiches.parId(ficheId, campagneId)
    exiger(fiche, erreurs.introuvable('Fiche'))
    return fiche
  }

  /** Fiches de la campagne avec leurs facettes regroupées. */
  function fichesCompletes(campagneId) {
    const facettes = biblio.facettes.deLaCampagne(campagneId)
    return biblio.fiches.deLaCampagne(campagneId).map((fiche) => ({ ...fiche, facettes: facettes.filter((f) => f.ficheId === fiche.id) }))
  }

  function ficheComplete(ficheId, campagneId) {
    return fichesCompletes(campagneId).find((f) => f.id === ficheId)
  }

  function exigerFacette(fiche, facetteId) {
    const facette = fiche.facettes.find((f) => f.id === facetteId)
    exiger(facette, erreurs.introuvable('Facette'))
    return facette
  }

  const valeurDe = (fiche, cle) => fiche.facettes.find((f) => f.cle === cle)?.valeur ?? ''

  function peutVoir(demandeurId, campagneId, fiche) {
    const role = roleDans(demandeurId, campagneId)
    if (!role) return false
    return estMj(role) || vueJoueur(fiche, fiche.facettes, demandeurId) !== null
  }

  /** Une note privée n'est vue que de son auteur et des MJ ; une note de groupe, de tous ceux qui voient la fiche. */
  function notesVisibles(ficheId, demandeurId, mj) {
    return biblio.notes.deLaFiche(ficheId)
      .filter((n) => mj || n.visibilite === 'groupe' || n.auteurId === demandeurId)
      .map(({ auteurId, ...note }) => ({ ...note, mienne: auteurId === demandeurId }))
  }

  function lecturesDe(campagneId) {
    const contenu = depots.etats.lire(campagneId)?.contenu
    return contenu ? JSON.parse(contenu).regles?.lectures ?? [] : []
  }

  function creerFicheAvecFacettes(campagneId, { type = 'pnj', nom, facettes = {}, secrets = [], notesMj = '' }) {
    const ficheId = biblio.fiches.creer({ campagneId, type, creeLe: iso() })
    FACETTES_PNJ.forEach((cle, i) => {
      const valeur = cle === 'nom' ? nom : String(facettes[cle] ?? '')
      if (cle !== 'portrait') {
        const probleme = erreurFacette(cle, valeur)
        exiger(!probleme, erreurs.requeteInvalide(`${nom} — ${cle} : ${probleme}`))
      }
      biblio.facettes.creer({ ficheId, cle, valeur: cle === 'portrait' ? '' : valeur, ordre: i + 1 })
    })
    secrets.forEach((secret, i) => {
      exiger(!erreurTitreSecret(secret.titre) && !erreurFacette('secret', secret.texte), erreurs.requeteInvalide(`${nom} : secret invalide.`))
      biblio.facettes.creer({ ficheId, cle: 'secret', titre: secret.titre.trim(), valeur: secret.texte, ordre: FACETTES_PNJ.length + i + 1 })
    })
    if (notesMj) biblio.fiches.changerNotesMj(ficheId, notesMj)
    return ficheId
  }

  return {
    /** Liste des fiches : toutes pour un MJ, seulement ce qui a été révélé pour un joueur. */
    bibliotheque({ demandeurId, campagneId }) {
      const role = roleDans(demandeurId, campagneId)
      exiger(role, erreurs.interdit())
      const fiches = fichesCompletes(campagneId)
      if (!estMj(role)) {
        return { estMj: false, fiches: fiches.map((f) => vueJoueur(f, f.facettes, demandeurId)).filter(Boolean) }
      }
      const nombres = Object.fromEntries(biblio.notes.nombreParFiche(campagneId).map((n) => [n.ficheId, n.n]))
      return {
        estMj: true,
        fiches: fiches.map((f) => ({
          id: f.id,
          type: f.type,
          nom: valeurDe(f, 'nom'),
          portrait: valeurDe(f, 'portrait') || null,
          role: valeurDe(f, 'role'),
          attitude: valeurDe(f, 'attitude'),
          revelation: etatDeRevelation(f.facettes),
          nombreNotes: nombres[f.id] ?? 0,
        })),
      }
    },

    fiche({ demandeurId, campagneId, ficheId }) {
      const role = roleDans(demandeurId, campagneId)
      exiger(role, erreurs.interdit())
      const fiche = ficheComplete(ficheId, campagneId)
      exiger(fiche, erreurs.introuvable('Fiche'))
      if (estMj(role)) {
        return {
          estMj: true,
          id: fiche.id,
          type: fiche.type,
          notesMj: fiche.notesMj,
          facettes: fiche.facettes.map(({ ficheId: _f, ...f }) => f),
          notes: notesVisibles(fiche.id, demandeurId, true),
          joueurs: joueursDe(campagneId).map(({ id, identifiant, role: r }) => ({ id, identifiant, role: r })),
          lectures: lecturesDe(campagneId),
        }
      }
      const vue = vueJoueur(fiche, fiche.facettes, demandeurId)
      exiger(vue, erreurs.introuvable('Fiche'))
      return { estMj: false, fiche: vue, notes: notesVisibles(fiche.id, demandeurId, false) }
    },

    creerFiche({ demandeurId, campagneId, nom }) {
      exigerMj(demandeurId, campagneId)
      const probleme = erreurFacette('nom', String(nom ?? ''))
      exiger(!probleme, erreurs.requeteInvalide(probleme))
      return transaction(db, () => ({ ficheId: creerFicheAvecFacettes(campagneId, { nom: nom.trim() }) }))
    },

    modifierFacette({ demandeurId, campagneId, ficheId, facetteId, valeur, titre }) {
      exigerMj(demandeurId, campagneId)
      const fiche = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      const facette = exigerFacette(fiche, facetteId)
      exiger(facette.cle !== 'portrait', erreurs.requeteInvalide('Le portrait se change en téléversant une image.'))
      const probleme = erreurFacette(facette.cle, valeur)
      exiger(!probleme, erreurs.requeteInvalide(probleme))
      if (facette.cle === 'secret' && titre !== undefined) {
        const erreurTitre = erreurTitreSecret(titre)
        exiger(!erreurTitre, erreurs.requeteInvalide(erreurTitre))
      }
      biblio.facettes.changer(facette.id, facette.cle === 'nom' ? valeur.trim() : valeur, facette.cle === 'secret' ? titre?.trim() ?? null : null)
    },

    ajouterSecret({ demandeurId, campagneId, ficheId, titre, texte }) {
      exigerMj(demandeurId, campagneId)
      exigerFiche(ficheId, campagneId)
      const probleme = erreurTitreSecret(titre) ?? erreurFacette('secret', texte)
      exiger(!probleme, erreurs.requeteInvalide(probleme))
      const facetteId = biblio.facettes.creer({ ficheId, cle: 'secret', titre: titre.trim(), valeur: texte, ordre: biblio.facettes.prochainOrdre(ficheId) })
      return { facetteId }
    },

    supprimerSecret({ demandeurId, campagneId, ficheId, facetteId }) {
      exigerMj(demandeurId, campagneId)
      const facette = exigerFacette(ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId), facetteId)
      exiger(facette.cle === 'secret', erreurs.requeteInvalide('Seuls les secrets peuvent être supprimés.'))
      biblio.facettes.supprimer(facette.id)
    },

    modifierNotesMj({ demandeurId, campagneId, ficheId, notesMj }) {
      exigerMj(demandeurId, campagneId)
      exigerFiche(ficheId, campagneId)
      exiger(typeof notesMj === 'string' && notesMj.length <= LONGUEUR_MAX_NOTES_MJ, erreurs.requeteInvalide('Notes du MJ invalides ou trop longues.'))
      biblio.fiches.changerNotesMj(ficheId, notesMj)
    },

    supprimerFiche({ demandeurId, campagneId, ficheId }) {
      exigerMj(demandeurId, campagneId)
      const fiche = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      const portrait = valeurDe(fiche, 'portrait')
      transaction(db, () => {
        biblio.fiches.supprimer(fiche.id)
        if (portrait) biblio.images.supprimer(portrait)
      })
      if (portrait) images.supprimer(portrait)
    },

    /** Remplace la liste de ceux qui voient une facette : tout le groupe, certains joueurs, ou personne. */
    reveler({ demandeurId, campagneId, ficheId, facetteId, pourTous, joueurs = [] }) {
      exigerMj(demandeurId, campagneId)
      const avant = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      exigerFacette(avant, facetteId)
      const joueursCampagne = joueursDe(campagneId)
      const idsJoueurs = new Set(joueursCampagne.map((j) => j.id))
      exiger(typeof pourTous === 'boolean' && Array.isArray(joueurs), erreurs.requeteInvalide('Révélation invalide.'))
      exiger(joueurs.every((id) => idsJoueurs.has(id)), erreurs.requeteInvalide("On ne révèle qu'à des joueurs de la campagne."))
      const cibles = pourTous ? [null] : [...new Set(joueurs)]

      transaction(db, () => {
        biblio.facettes.remplacerRevelations(facetteId, cibles, iso())
        const apres = ficheComplete(ficheId, campagneId)
        // Ne prévient que ceux qui découvrent quelque chose, avec le nom tel qu'eux le connaissent.
        const facetteApres = apres.facettes.find((f) => f.id === facetteId)
        if (facetteApres.valeur === '') return
        const voyaitAvant = (id) => avant.facettes.find((f) => f.id === facetteId).revelations.some((r) => r.pourTous || r.utilisateurId === id)
        for (const joueur of joueursCampagne) {
          const voitMaintenant = facetteApres.revelations.some((r) => r.pourTous || r.utilisateurId === joueur.id)
          if (!voitMaintenant || voyaitAvant(joueur.id)) continue
          const nom = vueJoueur(apres, apres.facettes, joueur.id)?.nom ?? 'un personnage'
          notifications.creer({
            utilisateurId: joueur.id, campagneId, texte: `Nouvelle information : ${nom}.`, lien: `/campagne/${campagneId}/bibliotheque/${ficheId}`, creeLe: iso(),
          })
        }
      })
    },

    definirPortrait({ demandeurId, campagneId, ficheId, octets }) {
      exigerMj(demandeurId, campagneId)
      const fiche = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      exiger(Buffer.isBuffer(octets), erreurs.requeteInvalide('Envoie une image PNG, JPEG ou WebP.'))
      exiger(octets.length <= TAILLE_MAX_IMAGE, erreurs.requeteInvalide('Image trop lourde (5 Mo au plus).'))
      const typeMime = typeImage(octets)
      exiger(typeMime, erreurs.requeteInvalide('Formats acceptés : PNG, JPEG ou WebP.'))

      const facette = fiche.facettes.find((f) => f.cle === 'portrait')
      const ancienne = facette.valeur
      const imageId = randomUUID()
      images.ecrire(imageId, octets)
      try {
        transaction(db, () => {
          biblio.images.creer({ id: imageId, campagneId, typeMime, taille: octets.length, creeLe: iso() })
          biblio.facettes.changer(facette.id, imageId, null)
          if (ancienne) biblio.images.supprimer(ancienne)
        })
      } catch (erreur) {
        images.supprimer(imageId) // pas de fichier orphelin si la base refuse
        throw erreur
      }
      if (ancienne) images.supprimer(ancienne)
      return { imageId }
    },

    /** Un portrait n'est servi qu'aux MJ, ou aux joueurs à qui il a été révélé. */
    lireImage({ demandeurId, campagneId, imageId }) {
      const role = roleDans(demandeurId, campagneId)
      exiger(role, erreurs.interdit())
      const image = biblio.images.parId(String(imageId), campagneId)
      exiger(image, erreurs.introuvable('Image'))
      if (!estMj(role)) {
        const visible = fichesCompletes(campagneId).some((f) => vueJoueur(f, f.facettes, demandeurId)?.portrait === image.id)
        exiger(visible, erreurs.introuvable('Image'))
      }
      const octets = images.lire(image.id)
      exiger(octets, erreurs.introuvable('Image'))
      return { octets, type: image.typeMime }
    },

    ajouterNote({ demandeurId, campagneId, ficheId, type, visibilite, texte }) {
      const fiche = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      exiger(peutVoir(demandeurId, campagneId, fiche), erreurs.introuvable('Fiche'))
      const probleme = erreurNote({ type, visibilite, texte })
      exiger(!probleme, erreurs.requeteInvalide(probleme))
      return { noteId: biblio.notes.creer({ ficheId, auteurId: demandeurId, type, visibilite, texte: texte.trim(), le: iso() }) }
    },

    modifierNote({ demandeurId, campagneId, noteId, texte, visibilite }) {
      const note = biblio.notes.parId(noteId, campagneId)
      exiger(note, erreurs.introuvable('Note'))
      // Un membre retiré garde le droit d'effacer ses notes, pas celui de les réécrire.
      exiger(note.auteurId === demandeurId && roleDans(demandeurId, campagneId), erreurs.interdit())
      const probleme = erreurNote({ type: note.type, visibilite, texte })
      exiger(!probleme, erreurs.requeteInvalide(probleme))
      biblio.notes.changer(note.id, texte.trim(), visibilite, iso())
    },

    supprimerNote({ demandeurId, campagneId, noteId }) {
      const note = biblio.notes.parId(noteId, campagneId)
      exiger(note, erreurs.introuvable('Note'))
      exiger(note.auteurId === demandeurId || estMj(roleDans(demandeurId, campagneId)), erreurs.interdit())
      biblio.notes.supprimer(note.id)
    },

    /** Reporte la croyance d'un joueur dans le Registre des Croyances de la campagne (une seule fois). */
    compterCroyance({ demandeurId, campagneId, noteId, lecture }) {
      exigerMj(demandeurId, campagneId)
      const note = biblio.notes.parId(noteId, campagneId)
      exiger(note, erreurs.introuvable('Note'))
      exiger(note.type === 'croyance', erreurs.requeteInvalide('Seules les croyances comptent dans le registre.'))
      exiger(!note.lectureComptee, erreurs.requeteInvalide('Cette croyance a déjà été comptée.'))
      transaction(db, () => {
        const ligne = depots.etats.lire(campagneId)
        exiger(ligne, erreurs.mondeAbsent())
        const actuel = JSON.parse(ligne.contenu)
        // hasOwn : une clé héritée (toString, __proto__…) ne doit jamais passer pour une lecture.
        exiger(typeof lecture === 'string' && Object.hasOwn(actuel.croyances ?? {}, lecture), erreurs.requeteInvalide('Lecture inconnue.'))
        let etat
        try {
          etat = noterCroyance(actuel, lecture, note.texte)
        } catch (erreur) {
          throw erreurs.requeteInvalide(erreur.message)
        }
        depots.etats.ecrire(campagneId, JSON.stringify(etat), iso())
        biblio.notes.compter(note.id, lecture, iso())
      })
    },

    /** Reprise des PNJ préparés à l'avance (ligne de commande) : tout arrive caché. */
    importerFiches(campagneId, donnees) {
      exiger(depots.campagnes.parId(campagneId), erreurs.introuvable('Campagne'))
      exiger(Array.isArray(donnees?.fiches), erreurs.requeteInvalide('Fichier invalide : liste « fiches » attendue.'))
      return transaction(db, () => {
        for (const fiche of donnees.fiches) {
          exiger(!erreurFacette('nom', String(fiche.nom ?? '')), erreurs.requeteInvalide('Une fiche sans nom a été trouvée.'))
          creerFicheAvecFacettes(campagneId, fiche)
        }
        return { nombre: donnees.fiches.length }
      })
    },

    /** Un membre retiré ne garde pas les révélations qui lui étaient destinées. */
    oublierRevelationsDe(utilisateurId, campagneId) {
      biblio.facettes.retirerRevelationsDe(utilisateurId, campagneId)
    },

    /** Part de l'export RGPD : les notes écrites, avec le nom du PNJ tel que l'auteur le connaît. */
    donneesBibliothequeDe(utilisateurId) {
      return {
        notes: biblio.notes.de(utilisateurId).map((n) => {
          const fiche = ficheComplete(n.ficheId, n.campagneId)
          const role = roleDans(utilisateurId, n.campagneId)
          // Plus membre : on ne lui apprend pas ce qui a été révélé depuis son départ.
          let nom = 'un personnage inconnu'
          if (estMj(role)) nom = valeurDe(fiche, 'nom')
          else if (role) nom = vueJoueur(fiche, fiche.facettes, utilisateurId)?.nom ?? nom
          return { campagne: n.campagne, fiche: nom, type: n.type, visibilite: n.visibilite, texte: n.texte, creeLe: n.creeLe }
        }),
      }
    },
  }
}
