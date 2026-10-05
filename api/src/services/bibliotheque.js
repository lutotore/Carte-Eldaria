import { randomUUID } from 'node:crypto'
import { noterCroyance } from '../../../src/domain/suivi.js'
import { erreurs } from '../domaine/erreurs.js'
import {
  aDecouvert, ESTIMABLES, erreurFacette, erreurNote, erreurTitreSecret, etatDeRevelation, FACETTES_PAR_TYPE, grilleEstimations,
  LIBELLES_FACETTES, TITREES_PAR_TYPE, vueJoueur,
} from '../../../src/domain/fiches.js'
import { estMj } from '../domaine/roles.js'
import { transaction } from '../infra/base.js'
import { creerDepotsBibliotheque } from '../infra/depotsBibliotheque.js'
import { creerDepotsPlanning } from '../infra/depotsPlanning.js'

const TAILLE_MAX_IMAGE = 5 * 1024 * 1024
const TAILLE_MAX_PDF = 10 * 1024 * 1024
/** Facette qui reçoit le fichier téléversé : le portrait, ou le document lui-même pour un handout. */
const facetteFichier = (type) => (type === 'document' ? 'fichier' : 'portrait')
const LONGUEUR_MAX_ESTIMATION = 200
/** Adresse de la page de chaque type de fiche, et nom donné tant que le vrai n'est pas connu. */
const CHEMINS = { pnj: 'bibliotheque', creature: 'bestiaire', lieu: 'lieux', document: 'documents', objet: 'objets' }
const INCONNUS = { pnj: 'un personnage', creature: 'une créature', lieu: 'un lieu', document: 'un document', objet: 'un objet' }
/** Clés du fichier d'import pour chaque facette titrée. */
const LISTES_IMPORT = { secret: 'secrets', capacite: 'capacites', action: 'actions', reaction: 'reactions', propriete: 'proprietes' }
const LONGUEUR_MAX_NOTES_MJ = 20_000

/** Type d'image reconnu à ses premiers octets (on ne se fie jamais au nom ni au type annoncé). */
function typeImage(octets) {
  const debut = (...valeurs) => valeurs.every((v, i) => octets[i] === v)
  if (debut(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (debut(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (octets.subarray(0, 4).toString('latin1') === 'RIFF' && octets.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  if (octets.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
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

  function exigerType(type) {
    exiger(Object.hasOwn(FACETTES_PAR_TYPE, type), erreurs.requeteInvalide('Type de fiche inconnu.'))
  }

  /** Îles du monde de la campagne, pour rattacher un lieu. */
  function ilesDe(campagneId) {
    const contenu = depots.etats.lire(campagneId)?.contenu
    const iles = contenu ? JSON.parse(contenu).iles ?? {} : {}
    return Object.entries(iles).map(([id, ile]) => ({ id, nom: ile.nom, revelee: Boolean(ile.revelee) }))
  }

  /** L'île d'un lieu, telle qu'un lecteur a le droit de la connaître : un joueur ne la voit que révélée sur la carte. */
  function ileDuLieu(fiche, iles, pourMj) {
    const ile = iles.find((i) => i.id === fiche.ile && (pourMj || i.revelee))
    return { ile: ile?.id ?? null, nomIle: ile?.nom ?? null }
  }

  /** Format du fichier d'un document (PDF ou image), pour l'afficher ou le proposer au téléchargement. */
  function typeFichier(campagneId, imageId) {
    return imageId ? biblio.images.parId(imageId, campagneId)?.typeMime ?? null : null
  }

  /** Ce qu'un joueur voit d'une fiche, complété de ce qui dépend du reste de la campagne. */
  function vuePourJoueur(fiche, demandeurId, campagneId, iles) {
    const vue = vueJoueur(fiche, fiche.facettes, demandeurId)
    if (!vue) return null
    if (fiche.type === 'lieu') return { ...vue, ...ileDuLieu(fiche, iles, false) }
    if (fiche.type === 'document') return { ...vue, typeFichier: typeFichier(campagneId, vue.fichier) }
    return vue
  }

  function exigerIle(campagneId, ile) {
    exiger(ile === '' || ile === null || ilesDe(campagneId).some((i) => i.id === ile), erreurs.requeteInvalide('Île inconnue.'))
  }

  function creerFicheAvecFacettes(campagneId, { type = 'pnj', nom, ile = '', facettes = {}, notesMj = '', ...listes }) {
    exigerType(type)
    const ficheId = biblio.fiches.creer({ campagneId, type, creeLe: iso() })
    if (type === 'lieu' && ile) {
      exigerIle(campagneId, ile)
      biblio.fiches.changerIle(ficheId, ile)
    }
    let ordre = 0
    for (const cle of FACETTES_PAR_TYPE[type]) {
      const fichier = cle === 'portrait' || cle === 'fichier'
      const valeur = cle === 'nom' ? nom : String(facettes[cle] ?? '')
      if (!fichier) {
        const probleme = erreurFacette(cle, valeur)
        exiger(!probleme, erreurs.requeteInvalide(`${nom} — ${cle} : ${probleme}`))
      }
      biblio.facettes.creer({ ficheId, cle, valeur: fichier ? '' : valeur, ordre: (ordre += 1) })
    }
    for (const cle of TITREES_PAR_TYPE[type]) {
      for (const element of listes[LISTES_IMPORT[cle]] ?? []) {
        exiger(!erreurTitreSecret(element.titre) && !erreurFacette(cle, element.texte), erreurs.requeteInvalide(`${nom} : ${LIBELLES_FACETTES[cle].toLowerCase()} invalide.`))
        biblio.facettes.creer({ ficheId, cle, titre: element.titre.trim(), valeur: element.texte, ordre: (ordre += 1) })
      }
    }
    if (notesMj) biblio.fiches.changerNotesMj(ficheId, notesMj)
    return ficheId
  }

  /** Ajoute une facette titrée : secret, capacité, action ou réaction selon le type de fiche. */
  function ajouterTitree({ demandeurId, campagneId, ficheId, cle = 'secret', titre, texte }) {
    exigerMj(demandeurId, campagneId)
    const fiche = exigerFiche(ficheId, campagneId)
    exiger(TITREES_PAR_TYPE[fiche.type].includes(cle), erreurs.requeteInvalide("Ce type d'élément n'existe pas pour cette fiche."))
    const probleme = erreurTitreSecret(titre) ?? erreurFacette(cle, texte)
    exiger(!probleme, erreurs.requeteInvalide(probleme))
    const facetteId = biblio.facettes.creer({ ficheId, cle, titre: titre.trim(), valeur: texte, ordre: biblio.facettes.prochainOrdre(ficheId) })
    return { facetteId }
  }

  function estimationsDe(ficheId) {
    return Object.fromEntries(biblio.estimations.deLaFiche(ficheId).map(({ cle, ...e }) => [cle, e]))
  }

  /**
   * Prévient chaque joueur qui découvre quelque chose entre deux états de la fiche,
   * avec le nom du personnage tel que lui le connaît.
   */
  function notifierDecouvertes(campagneId, avant, apres) {
    for (const joueur of joueursDe(campagneId)) {
      const vueApres = vueJoueur(apres, apres.facettes, joueur.id)
      if (!aDecouvert(vueJoueur(avant, avant.facettes, joueur.id), vueApres)) continue
      const nomApres = vueApres.nom
      const chemin = CHEMINS[apres.type]
      notifications.creer({
        utilisateurId: joueur.id, campagneId, texte: `Nouvelle information : ${nomApres ?? INCONNUS[apres.type]}.`,
        lien: `/campagne/${campagneId}/${chemin}/${apres.id}`, creeLe: iso(),
      })
    }
  }

  return {
    /** Liste des fiches : toutes pour un MJ, seulement ce qui a été révélé pour un joueur. */
    bibliotheque({ demandeurId, campagneId, type = 'pnj' }) {
      const role = roleDans(demandeurId, campagneId)
      exiger(role, erreurs.interdit())
      exigerType(type)
      const fiches = fichesCompletes(campagneId).filter((f) => f.type === type)
      if (!estMj(role)) {
        const iles = ilesDe(campagneId)
        return { estMj: false, fiches: fiches.map((f) => vuePourJoueur(f, demandeurId, campagneId, iles)).filter(Boolean) }
      }
      const iles = ilesDe(campagneId)
      const nombres = Object.fromEntries(biblio.notes.nombreParFiche(campagneId).map((n) => [n.ficheId, n.n]))
      return {
        estMj: true,
        fiches: fiches.map((f) => ({
          id: f.id,
          type: f.type,
          nom: valeurDe(f, 'nom'),
          portrait: valeurDe(f, 'portrait') || null,
          role: valeurDe(f, { creature: 'nature', pnj: 'role', objet: 'nature' }[f.type] ?? ''),
          ...(f.type === 'lieu' ? ileDuLieu(f, iles, true) : {}),
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
          estimations: fiche.type === 'creature' ? estimationsDe(fiche.id) : {},
          ...(fiche.type === 'lieu' ? { ile: fiche.ile ?? null, iles: ilesDe(campagneId).map(({ id, nom }) => ({ id, nom })) } : {}),
          ...(fiche.type === 'document' ? { typeFichier: typeFichier(campagneId, valeurDe(fiche, 'fichier')) } : {}),
          joueurs: joueursDe(campagneId).map(({ id, identifiant, role: r }) => ({ id, identifiant, role: r })),
          lectures: lecturesDe(campagneId),
        }
      }
      const vue = vuePourJoueur(fiche, demandeurId, campagneId, ilesDe(campagneId))
      exiger(vue, erreurs.introuvable('Fiche'))
      const grille = fiche.type === 'creature' ? grilleEstimations(fiche.facettes, estimationsDe(fiche.id), demandeurId) : []
      return { estMj: false, fiche: vue, grille, notes: notesVisibles(fiche.id, demandeurId, false) }
    },

    creerFiche({ demandeurId, campagneId, nom, type = 'pnj' }) {
      exigerMj(demandeurId, campagneId)
      exigerType(type)
      const probleme = erreurFacette('nom', String(nom ?? ''))
      exiger(!probleme, erreurs.requeteInvalide(probleme))
      return transaction(db, () => ({ ficheId: creerFicheAvecFacettes(campagneId, { type, nom: nom.trim() }) }))
    },

    modifierFacette({ demandeurId, campagneId, ficheId, facetteId, valeur, titre }) {
      exigerMj(demandeurId, campagneId)
      const fiche = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      const facette = exigerFacette(fiche, facetteId)
      exiger(facette.cle !== 'portrait' && facette.cle !== 'fichier', erreurs.requeteInvalide('Une image ou un document se change en téléversant un fichier.'))
      const probleme = erreurFacette(facette.cle, valeur)
      exiger(!probleme, erreurs.requeteInvalide(probleme))
      const titree = TITREES_PAR_TYPE[fiche.type].includes(facette.cle)
      if (titree && titre !== undefined) {
        const erreurTitre = erreurTitreSecret(titre)
        exiger(!erreurTitre, erreurs.requeteInvalide(erreurTitre))
      }
      biblio.facettes.changer(facette.id, facette.cle === 'nom' ? valeur.trim() : valeur, titree ? titre?.trim() ?? null : null)
    },

    ajouterTitree,

    ajouterSecret(demande) {
      return ajouterTitree({ ...demande, cle: 'secret' })
    },

    supprimerSecret({ demandeurId, campagneId, ficheId, facetteId }) {
      exigerMj(demandeurId, campagneId)
      const fiche = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      const facette = exigerFacette(fiche, facetteId)
      exiger(TITREES_PAR_TYPE[fiche.type].includes(facette.cle), erreurs.requeteInvalide('Seuls les éléments ajoutés (secrets, capacités, actions…) peuvent être supprimés.'))
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
      const image = valeurDe(fiche, facetteFichier(fiche.type))
      transaction(db, () => {
        biblio.fiches.supprimer(fiche.id)
        if (image) biblio.images.supprimer(image)
      })
      if (image) images.supprimer(image)
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
        notifierDecouvertes(campagneId, avant, ficheComplete(ficheId, campagneId))
      })
    },

    /** Révèle au groupe tout ce qui est rempli sur la fiche (pratique après un combat). */
    revelerTout({ demandeurId, campagneId, ficheId }) {
      exigerMj(demandeurId, campagneId)
      const avant = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      transaction(db, () => {
        for (const facette of avant.facettes.filter((f) => f.valeur !== '')) {
          biblio.facettes.remplacerRevelations(facette.id, [null], iso())
        }
        notifierDecouvertes(campagneId, avant, ficheComplete(ficheId, campagneId))
      })
    },

    changerIle({ demandeurId, campagneId, ficheId, ile }) {
      exigerMj(demandeurId, campagneId)
      const fiche = exigerFiche(ficheId, campagneId)
      exiger(fiche.type === 'lieu', erreurs.requeteInvalide('Seul un lieu se rattache à une île.'))
      exigerIle(campagneId, ile)
      biblio.fiches.changerIle(fiche.id, ile || null)
    },

    /** Le destinataire d'un document le partage avec tout le groupe : seulement ce qu'il en voit lui-même. */
    partager({ demandeurId, campagneId, ficheId }) {
      const role = roleDans(demandeurId, campagneId)
      exiger(role, erreurs.interdit())
      const avant = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      const vue = vueJoueur(avant, avant.facettes, demandeurId)
      exiger(estMj(role) || vue, erreurs.introuvable('Fiche'))
      exiger(!estMj(role), erreurs.interdit())
      exiger(avant.type === 'document', erreurs.requeteInvalide('Seuls les documents se partagent.'))
      const visibles = avant.facettes.filter((f) => f.valeur !== '' && f.revelations.some((r) => r.pourTous || r.utilisateurId === demandeurId))
      transaction(db, () => {
        for (const facette of visibles) biblio.facettes.remplacerRevelations(facette.id, [null], iso())
        const apres = ficheComplete(ficheId, campagneId)
        const auteur = depots.utilisateurs.parId(demandeurId).identifiant
        for (const joueur of joueursDe(campagneId).filter((j) => j.id !== demandeurId)) {
          const vueAvant = vueJoueur(avant, avant.facettes, joueur.id)
          const vueApres = vueJoueur(apres, apres.facettes, joueur.id)
          if (!aDecouvert(vueAvant, vueApres)) continue
          notifications.creer({
            utilisateurId: joueur.id, campagneId, texte: `${auteur} partage un document : ${vueApres.nom ?? 'un document'}.`,
            lien: `/campagne/${campagneId}/documents/${ficheId}`, creeLe: iso(),
          })
        }
      })
    },

    /** Estimation partagée par les joueurs d'une statistique de créature ; un texte vide l'efface. */
    estimer({ demandeurId, campagneId, ficheId, cle, texte }) {
      const role = roleDans(demandeurId, campagneId)
      exiger(role, erreurs.interdit())
      const fiche = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      exiger(estMj(role) || vueJoueur(fiche, fiche.facettes, demandeurId), erreurs.introuvable('Fiche'))
      exiger(!estMj(role), erreurs.interdit())
      exiger(fiche.type === 'creature' && ESTIMABLES.includes(cle), erreurs.requeteInvalide('Cette statistique ne peut pas être estimée.'))
      exiger(typeof texte === 'string' && texte.length <= LONGUEUR_MAX_ESTIMATION, erreurs.requeteInvalide(`Estimation trop longue (${LONGUEUR_MAX_ESTIMATION} caractères au plus).`))
      if (texte.trim() === '') biblio.estimations.effacer(fiche.id, cle)
      else biblio.estimations.ecrire({ ficheId: fiche.id, cle, texte: texte.trim(), auteurId: demandeurId, majLe: iso() })
    },

    definirPortrait({ demandeurId, campagneId, ficheId, octets }) {
      exigerMj(demandeurId, campagneId)
      const fiche = ficheComplete(exigerFiche(ficheId, campagneId).id, campagneId)
      const accepteLesPdf = fiche.type === 'document'
      exiger(Buffer.isBuffer(octets), erreurs.requeteInvalide(accepteLesPdf ? 'Envoie une image ou un PDF.' : 'Envoie une image PNG, JPEG ou WebP.'))
      const typeMime = typeImage(octets)
      exiger(typeMime && (accepteLesPdf || typeMime !== 'application/pdf'),
        erreurs.requeteInvalide(accepteLesPdf ? 'Formats acceptés : PNG, JPEG, WebP ou PDF.' : 'Formats acceptés : PNG, JPEG ou WebP.'))
      const tailleMax = typeMime === 'application/pdf' ? TAILLE_MAX_PDF : TAILLE_MAX_IMAGE
      exiger(octets.length <= tailleMax, erreurs.requeteInvalide(`Fichier trop lourd (${tailleMax / 1024 / 1024} Mo au plus).`))

      const facette = fiche.facettes.find((f) => f.cle === facetteFichier(fiche.type))
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
        const visible = fichesCompletes(campagneId).some((f) => {
          const vue = vueJoueur(f, f.facettes, demandeurId)
          return vue && (vue.portrait === image.id || vue.fichier === image.id)
        })
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

    /**
     * Pour l'inventaire et les butins : ce qu'un lecteur sait des objets de la bibliothèque.
     * Renvoie une fonction ficheId → { id, nom } (le nom pouvant rester inconnu), ou null si le lecteur n'en sait rien.
     */
    lecteurDObjets(campagneId, utilisateurId, pourMj) {
      const objets = new Map(fichesCompletes(campagneId).filter((f) => f.type === 'objet').map((f) => [f.id, f]))
      return (ficheId) => {
        const fiche = objets.get(ficheId)
        if (!fiche) return null
        if (pourMj) return { id: fiche.id, nom: valeurDe(fiche, 'nom') }
        const vue = vueJoueur(fiche, fiche.facettes, utilisateurId)
        return vue ? { id: fiche.id, nom: vue.nom } : null
      }
    },

    /** Une fiche d'objet de la campagne, pour y relier un objet de butin. */
    exigerFicheObjet(ficheId, campagneId) {
      const fiche = biblio.fiches.parId(ficheId, campagneId)
      exiger(fiche?.type === 'objet', erreurs.requeteInvalide("Ce n'est pas un objet de la bibliothèque."))
    },

    /** Les fiches d'objets par nom, pour relier les butins importés. */
    objetsParNom(campagneId) {
      return new Map(fichesCompletes(campagneId).filter((f) => f.type === 'objet').map((f) => [valeurDe(f, 'nom'), f.id]))
    },

    /** Un membre retiré ne garde pas les révélations qui lui étaient destinées. */
    oublierRevelationsDe(utilisateurId, campagneId) {
      biblio.facettes.retirerRevelationsDe(utilisateurId, campagneId)
    },

    /** Part de l'export RGPD : les notes écrites, avec le nom du PNJ tel que l'auteur le connaît. */
    donneesBibliothequeDe(utilisateurId) {
      /** Le nom de la fiche tel que l'utilisateur le connaît ; plus membre, on ne lui apprend rien de nouveau. */
      const nomConnu = (ficheId, campagneId) => {
        const fiche = ficheComplete(ficheId, campagneId)
        const role = roleDans(utilisateurId, campagneId)
        if (estMj(role)) return valeurDe(fiche, 'nom')
        const inconnu = `${INCONNUS[fiche.type]} inconnu${fiche.type === 'creature' ? 'e' : ''}`
        return role ? vueJoueur(fiche, fiche.facettes, utilisateurId)?.nom ?? inconnu : inconnu
      }
      return {
        notes: biblio.notes.de(utilisateurId).map((n) => ({
          campagne: n.campagne, fiche: nomConnu(n.ficheId, n.campagneId), type: n.type, visibilite: n.visibilite, texte: n.texte, creeLe: n.creeLe,
        })),
        estimations: biblio.estimations.de(utilisateurId).map((e) => ({
          campagne: e.campagne, fiche: nomConnu(e.ficheId, e.campagneId), statistique: LIBELLES_FACETTES[e.cle], texte: e.texte, majLe: e.majLe,
        })),
      }
    },
  }
}
