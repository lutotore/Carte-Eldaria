import {
  additionner, erreurButin, erreurMarque, erreurObjetButin, erreurPrisePieces, STATUTS_BUTIN,
} from '../../../src/domain/butins.js'
import { calculs, erreurBourse, erreurChamps, erreurLigne, ficheVierge, PIECES } from '../../../src/domain/personnage.js'
import { creerCatalogue } from '../../../src/domain/regles/catalogue.js'
import {
  annulerDerniereMontee, appliquerMontee, classesPossibles, erreurMontee, erreurRattachement, optionsDeMontee, rattacher,
} from '../../../src/domain/regles/montee.js'
import { ELEMENTS_SRD } from '../../../src/domain/regles/srd.js'
import { erreurs, ErreurMetier } from '../domaine/erreurs.js'
import { estMj } from '../domaine/roles.js'
import { transaction } from '../infra/base.js'
import { creerDepotsPersonnages } from '../infra/depotsPersonnages.js'
import { creerDepotsPlanning } from '../infra/depotsPlanning.js'

const bourseModifiee = () => new ErreurMetier('conflit', 'La bourse a changé entre-temps (une prise dans un butin ?). Recharge la fiche et recommence.')
const pourNotes = (texte) => texte.slice(0, 1000)
/** Ce que la montée de niveau tient à jour : on ne le change pas à la main sur une fiche qui suit les règles. */
const CHAMPS_DES_REGLES = ['niveau', 'classe', 'desDeVie']

/** « 20 po, 5 pa » : les pièces non nulles, de la plus précieuse à la plus modeste. */
const decrirePieces = (pieces) => PIECES.filter((p) => pieces[p.cle] > 0).map((p) => `${pieces[p.cle]} ${p.cle}`).join(', ')
const bourseSeule = (pieces) => Object.fromEntries(PIECES.map((p) => [p.cle, pieces?.[p.cle]]))

/**
 * Fiches de personnage (une par joueur et par campagne), inventaire, bourse, Marques du Rêve,
 * et butins de rencontre où les joueurs se servent.
 * Une fiche ne se lit que par son joueur et par les MJ ; chaque méthode vérifie elle-même les droits.
 */
const CATALOGUE_SRD = creerCatalogue(ELEMENTS_SRD)

export function creerPersonnages({ db, depots, maintenant, bibliotheque, catalogueRegles = () => CATALOGUE_SRD }) {
  const persos = creerDepotsPersonnages(db)
  const notifications = creerDepotsPlanning(db).notifications
  const iso = () => maintenant().toISOString()

  function exiger(condition, erreur) {
    if (!condition) throw erreur
  }
  const roleDans = (utilisateurId, campagneId) => depots.participations.role(utilisateurId, campagneId)
  const joueursDe = (campagneId) => depots.participations.membresDe(campagneId).filter((m) => !estMj(m.role))
  const mjDe = (campagneId) => depots.participations.membresDe(campagneId).filter((m) => estMj(m.role))

  function exigerMembre(demandeurId, campagneId) {
    const role = roleDans(demandeurId, campagneId)
    exiger(role, erreurs.interdit())
    return role
  }

  function exigerMj(demandeurId, campagneId) {
    exiger(estMj(roleDans(demandeurId, campagneId)), erreurs.interdit())
  }

  /** La fiche, si le demandeur est son joueur ou un MJ ; « introuvable » pour les autres, qui n'ont pas à savoir qu'elle existe. */
  function exigerAcces(demandeurId, campagneId, personnageId) {
    const role = exigerMembre(demandeurId, campagneId)
    const personnage = persos.personnages.parId(personnageId, campagneId)
    exiger(personnage && (estMj(role) || personnage.utilisateurId === demandeurId), erreurs.introuvable('Fiche de personnage'))
    return { personnage, role }
  }

  function exigerLigne(personnageId, ligneId) {
    const ligne = persos.inventaire.parId(ligneId, personnageId)
    exiger(ligne, erreurs.introuvable("Ligne d'inventaire"))
    return ligne
  }

  function exigerSansErreur(probleme) {
    exiger(!probleme, erreurs.requeteInvalide(probleme))
  }

  /** La fiche telle qu'on la lit : une fiche créée avant l'ajout d'un champ le reçoit avec sa valeur de départ. */
  const ficheComplete = (personnage) => ({ ...ficheVierge(personnage.fiche.nom), regles: null, ...personnage.fiche })

  function ecrireFiche(personnage, fiche) {
    const { regles, ...reste } = fiche
    persos.personnages.ecrireFiche(personnage.id, regles ? fiche : reste, iso())
  }

  function prevenirLesMj(personnage, fiche) {
    for (const mj of mjDe(personnage.campagneId)) {
      notifications.creer({
        utilisateurId: mj.id, campagneId: personnage.campagneId, texte: `${fiche.nom} passe au niveau ${fiche.niveau} : ${fiche.classe}.`,
        lien: `/campagne/${personnage.campagneId}/personnages/${personnage.id}`, categorie: 'personnage', creeLe: iso(),
      })
    }
  }

  const ligneLue = ({ libelle, quantite, notes = '' }) => ({ libelle: String(libelle ?? '').trim(), quantite, notes })

  function inventaireLu(personnage, lecteurId, pourMj) {
    const objet = bibliotheque.lecteurDObjets(personnage.campagneId, lecteurId, pourMj)
    return persos.inventaire.du(personnage.id).map(({ ficheId, ...ligne }) => ({ ...ligne, objet: ficheId ? objet(ficheId) : null }))
  }

  // --- Butins ---

  function exigerButin(butinId, campagneId) {
    const butin = persos.butins.parId(butinId, campagneId)
    exiger(butin, erreurs.introuvable('Butin'))
    return butin
  }

  function exigerObjetButin(butinId, objetId) {
    const objet = persos.objetsButin.parId(objetId, butinId)
    exiger(objet, erreurs.introuvable('Objet'))
    return objet
  }

  /** Le butin où un joueur se sert : ouvert, sinon il n'existe pas pour lui. Il lui faut aussi une fiche. */
  function exigerPrisePossible(demandeurId, campagneId, butinId) {
    const role = exigerMembre(demandeurId, campagneId)
    exiger(!estMj(role), erreurs.interdit())
    const butin = persos.butins.parId(butinId, campagneId)
    exiger(butin?.statut === 'ouvert', erreurs.introuvable('Butin'))
    const personnage = persos.personnages.de(demandeurId, campagneId)
    exiger(personnage, erreurs.requeteInvalide('Crée d’abord ta fiche de personnage pour y ranger ce que tu prends.'))
    return { butin, personnage }
  }

  function lireButinDemande({ titre, notesMj = '', pieces }) {
    const butin = { titre: String(titre ?? '').trim(), notesMj: String(notesMj ?? ''), pieces: bourseSeule(pieces) }
    exigerSansErreur(erreurButin(butin))
    return butin
  }

  function lireObjetDemande(campagneId, { libelle, quantite, description = '', ficheId = null }, regles = {}) {
    const objet = { libelle: String(libelle ?? '').trim(), quantite, description: String(description ?? ''), ficheId: ficheId ?? null }
    exigerSansErreur(erreurObjetButin(objet, regles))
    if (objet.ficheId !== null) bibliotheque.exigerFicheObjet(objet.ficheId, campagneId)
    return objet
  }

  function vueButin(butin, lecteurId, pourMj) {
    const objet = bibliotheque.lecteurDObjets(butin.campagneId, lecteurId, pourMj)
    const { notesMj, campagneId: _c, ...commun } = butin
    return {
      ...commun,
      ...(pourMj ? { notesMj } : {}),
      objets: persos.objetsButin.du(butin.id).map(({ ficheId, ...o }) => ({ ...o, objet: ficheId ? objet(ficheId) : null })),
      prises: persos.prises.du(butin.id),
    }
  }

  function noterPrise(butinId, demandeurId, texte) {
    persos.prises.creer({ butinId, utilisateurId: demandeurId, texte: `${depots.utilisateurs.parId(demandeurId).identifiant} prend ${texte}`, le: iso() })
  }

  function importerUnButin(campagneId, donnees, objetsParNom) {
    const butin = lireButinDemande(donnees)
    const butinId = persos.butins.creer({ campagneId, ...butin, le: iso() })
    for (const o of donnees.objets ?? []) {
      const objet = lireObjetDemande(campagneId, { libelle: o.nom, quantite: o.quantite, description: o.description, ficheId: objetsParNom.get(o.nom) ?? null })
      persos.objetsButin.creer({ butinId, ...objet })
    }
  }

  return {
    // --- Fiches ---
    /** MJ : toutes les fiches de la campagne. Joueur : l'identifiant de la sienne, ou null. */
    personnages({ demandeurId, campagneId }) {
      const role = exigerMembre(demandeurId, campagneId)
      if (!estMj(role)) return { estMj: false, personnageId: persos.personnages.de(demandeurId, campagneId)?.id ?? null }
      return {
        estMj: true,
        personnages: persos.personnages.deLaCampagne(campagneId).map(({ id, joueur, fiche, majLe }) => ({
          id, joueur, nom: fiche.nom, classe: fiche.classe, niveau: fiche.niveau, majLe,
        })),
      }
    },

    creerPersonnage({ demandeurId, campagneId, nom }) {
      const role = exigerMembre(demandeurId, campagneId)
      exiger(!estMj(role), erreurs.interdit())
      const fiche = ficheVierge(String(nom ?? '').trim())
      exigerSansErreur(erreurChamps({ nom: fiche.nom }))
      exiger(!persos.personnages.de(demandeurId, campagneId), erreurs.requeteInvalide('Tu as déjà une fiche de personnage dans cette campagne.'))
      return { personnageId: persos.personnages.creer({ campagneId, utilisateurId: demandeurId, fiche, le: iso() }) }
    },

    personnage({ demandeurId, campagneId, personnageId }) {
      const { personnage, role } = exigerAcces(demandeurId, campagneId, personnageId)
      const pourMj = estMj(role)
      const fiche = ficheComplete(personnage)
      return {
        id: personnage.id,
        joueur: personnage.joueur,
        estMj: pourMj,
        fiche,
        calculs: calculs(fiche),
        bourse: personnage.bourse,
        inventaire: inventaireLu(personnage, demandeurId, pourMj),
        marques: persos.marques.du(personnage.id),
        majLe: personnage.majLe,
      }
    },

    modifierPersonnage({ demandeurId, campagneId, personnageId, champs }) {
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      exigerSansErreur(erreurChamps(champs))
      const regle = personnage.fiche.regles && CHAMPS_DES_REGLES.find((cle) => Object.hasOwn(champs, cle))
      exiger(!regle, erreurs.requeteInvalide('Ta fiche suit les règles du site : le niveau, la classe et les dés de vie changent par la montée de niveau.'))
      const propres = Object.fromEntries(Object.entries(champs).map(([cle, valeur]) => [cle, cle === 'nom' ? valeur.trim() : valeur]))
      persos.personnages.ecrireFiche(personnage.id, { ...personnage.fiche, ...propres }, iso())
    },

    // --- Montée de niveau : le moteur de règles décide, la fiche n'est écrite qu'après ---
    /**
     * Ce que la fiche peut faire : se rattacher aux règles, ou monter d'un niveau (et annuler la dernière montée).
     * `classe` : la classe où prendre le niveau ; par défaut la première suivie.
     */
    optionsMontee({ demandeurId, campagneId, personnageId, classe = null }) {
      const fiche = ficheComplete(exigerAcces(demandeurId, campagneId, personnageId).personnage)
      if (!fiche.regles) {
        const regles = catalogueRegles()
        const classes = regles.classes().map((c) => ({
          id: c.id, nom: c.nom, niveauSousClasse: c.niveauSousClasse,
          sousClasses: regles.sousClassesDe(c.id).map((s) => ({ id: s.id, nom: s.nom })),
        }))
        return { rattachement: { niveau: fiche.niveau, classes } }
      }
      const derniere = fiche.regles.montees.at(-1)
      return {
        options: optionsDeMontee(fiche, catalogueRegles(), classe ?? fiche.regles.classes[0].classe),
        classes: classesPossibles(fiche, catalogueRegles()),
        annulable: derniere ? { niveau: derniere.niveau, classe: derniere.classe } : null,
      }
    },

    /** Une classe (`classe`, `sousClasse`) ou, pour une fiche déjà multiclassée, `classes: [{ classe, niveau, sousClasse }]`. */
    rattacherAuxRegles({ demandeurId, campagneId, personnageId, classe, sousClasse = null, classes }) {
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      const fiche = ficheComplete(personnage)
      const demande = Array.isArray(classes) ? { classes } : { classe, sousClasse }
      const regles = catalogueRegles()
      exigerSansErreur(erreurRattachement(fiche, demande, regles))
      ecrireFiche(personnage, rattacher(fiche, demande, regles))
    },

    monterDeNiveau({ demandeurId, campagneId, personnageId, demande }) {
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      const fiche = ficheComplete(personnage)
      const regles = catalogueRegles()
      exigerSansErreur(erreurMontee(fiche, demande, regles))
      const apres = appliquerMontee(fiche, demande, regles)
      transaction(db, () => {
        ecrireFiche(personnage, apres)
        prevenirLesMj(personnage, apres)
      })
    },

    annulerMontee({ demandeurId, campagneId, personnageId }) {
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      const fiche = ficheComplete(personnage)
      exiger(fiche.regles?.montees.length, erreurs.requeteInvalide('Aucune montée de niveau faite sur le site à annuler.'))
      ecrireFiche(personnage, annulerDerniereMontee(fiche, catalogueRegles()))
    },

    /** La fiche redevient libre : on peut à nouveau tout y écrire à la main. */
    detacherDesRegles({ demandeurId, campagneId, personnageId }) {
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      ecrireFiche(personnage, { ...personnage.fiche, regles: null })
    },

    /** Réservé aux MJ : un joueur ne doit pas pouvoir effacer ses Marques du Rêve en recréant sa fiche. */
    supprimerPersonnage({ demandeurId, campagneId, personnageId }) {
      const { personnage, role } = exigerAcces(demandeurId, campagneId, personnageId)
      exiger(estMj(role), erreurs.interdit())
      persos.personnages.supprimer(personnage.id)
    },

    changerBourse({ demandeurId, campagneId, personnageId, avant, apres }) {
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      exigerSansErreur(erreurBourse(bourseSeule(avant)) ?? erreurBourse(bourseSeule(apres)))
      exiger(persos.personnages.changerBourseSi(personnage.id, bourseSeule(avant), bourseSeule(apres), iso()), bourseModifiee())
    },

    // --- Inventaire ---
    ajouterLigne({ demandeurId, campagneId, personnageId, ...demande }) {
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      const ligne = ligneLue(demande)
      exigerSansErreur(erreurLigne(ligne))
      return { ligneId: persos.inventaire.creer({ personnageId: personnage.id, ...ligne, le: iso() }) }
    },

    modifierLigne({ demandeurId, campagneId, personnageId, ligneId, ...demande }) {
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      exigerLigne(personnage.id, ligneId)
      const ligne = ligneLue(demande)
      exigerSansErreur(erreurLigne(ligne))
      persos.inventaire.modifier(ligneId, ligne)
    },

    supprimerLigne({ demandeurId, campagneId, personnageId, ligneId }) {
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      exigerLigne(personnage.id, ligneId)
      persos.inventaire.supprimer(ligneId)
    },

    // --- Marques du Rêve : écrites par les MJ au moment où elles sont découvertes ---
    ajouterMarque({ demandeurId, campagneId, personnageId, titre, don = '', prix = '' }) {
      exigerMj(demandeurId, campagneId)
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      const marque = { titre: String(titre ?? '').trim(), don, prix }
      exigerSansErreur(erreurMarque(marque))
      return transaction(db, () => {
        const marqueId = persos.marques.creer({ personnageId: personnage.id, ...marque, le: iso() })
        notifications.creer({
          utilisateurId: personnage.utilisateurId, campagneId, texte: `Une Marque du Rêve apparaît sur ta fiche : ${marque.titre}.`,
          lien: `/campagne/${campagneId}/personnage`, categorie: 'personnage', creeLe: iso(),
        })
        return { marqueId }
      })
    },

    modifierMarque({ demandeurId, campagneId, personnageId, marqueId, titre, don = '', prix = '' }) {
      exigerMj(demandeurId, campagneId)
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      exiger(persos.marques.parId(marqueId, personnage.id), erreurs.introuvable('Marque'))
      const marque = { titre: String(titre ?? '').trim(), don, prix }
      exigerSansErreur(erreurMarque(marque))
      persos.marques.modifier(marqueId, marque)
    },

    supprimerMarque({ demandeurId, campagneId, personnageId, marqueId }) {
      exigerMj(demandeurId, campagneId)
      const { personnage } = exigerAcces(demandeurId, campagneId, personnageId)
      exiger(persos.marques.parId(marqueId, personnage.id), erreurs.introuvable('Marque'))
      persos.marques.supprimer(marqueId)
    },

    // --- Butins ---
    /** MJ : tous les butins, avec leurs notes. Joueurs : les butins ouverts seulement. */
    butins({ demandeurId, campagneId }) {
      const pourMj = estMj(exigerMembre(demandeurId, campagneId))
      const butins = persos.butins.deLaCampagne(campagneId).filter((b) => pourMj || b.statut === 'ouvert')
      return { estMj: pourMj, butins: butins.map((b) => vueButin(b, demandeurId, pourMj)) }
    },

    creerButin({ demandeurId, campagneId, ...demande }) {
      exigerMj(demandeurId, campagneId)
      return { butinId: persos.butins.creer({ campagneId, ...lireButinDemande(demande), le: iso() }) }
    },

    modifierButin({ demandeurId, campagneId, butinId, ...demande }) {
      exigerMj(demandeurId, campagneId)
      persos.butins.modifier(exigerButin(butinId, campagneId).id, lireButinDemande(demande))
    },

    supprimerButin({ demandeurId, campagneId, butinId }) {
      exigerMj(demandeurId, campagneId)
      persos.butins.supprimer(exigerButin(butinId, campagneId).id)
    },

    ajouterObjetButin({ demandeurId, campagneId, butinId, ...demande }) {
      exigerMj(demandeurId, campagneId)
      const butin = exigerButin(butinId, campagneId)
      return { objetId: persos.objetsButin.creer({ butinId: butin.id, ...lireObjetDemande(campagneId, demande) }) }
    },

    modifierObjetButin({ demandeurId, campagneId, butinId, objetId, ...demande }) {
      exigerMj(demandeurId, campagneId)
      const butin = exigerButin(butinId, campagneId)
      exigerObjetButin(butin.id, objetId)
      persos.objetsButin.modifier(objetId, lireObjetDemande(campagneId, demande, { minimum: 0 }))
    },

    supprimerObjetButin({ demandeurId, campagneId, butinId, objetId }) {
      exigerMj(demandeurId, campagneId)
      exigerObjetButin(exigerButin(butinId, campagneId).id, objetId)
      persos.objetsButin.supprimer(objetId)
    },

    /** Préparé, ouvert (les joueurs sont prévenus et se servent) ou clos. */
    changerStatutButin({ demandeurId, campagneId, butinId, statut }) {
      exigerMj(demandeurId, campagneId)
      const butin = exigerButin(butinId, campagneId)
      exiger(STATUTS_BUTIN.includes(statut), erreurs.requeteInvalide('Statut de butin inconnu.'))
      transaction(db, () => {
        persos.butins.changerStatut(butin.id, statut)
        if (statut !== 'ouvert' || butin.statut === 'ouvert') return
        for (const joueur of joueursDe(campagneId)) {
          notifications.creer({
            utilisateurId: joueur.id, campagneId, texte: `Butin à partager : ${butin.titre}.`, lien: `/campagne/${campagneId}/butins`, categorie: 'personnage', creeLe: iso(),
          })
        }
      })
    },

    prendreObjet({ demandeurId, campagneId, butinId, objetId, quantite }) {
      transaction(db, () => {
        const { butin, personnage } = exigerPrisePossible(demandeurId, campagneId, butinId)
        const objet = exigerObjetButin(butin.id, objetId)
        exiger(Number.isInteger(quantite) && quantite >= 1, erreurs.requeteInvalide('Indique combien tu en prends.'))
        exiger(quantite <= objet.quantite, erreurs.requeteInvalide('Il n’en reste pas autant dans le butin.'))
        persos.objetsButin.retirer(objet.id, quantite)
        const semblable = persos.inventaire.semblable(personnage.id, objet.libelle, objet.ficheId, quantite)
        if (semblable) persos.inventaire.ajouterQuantite(semblable.id, quantite)
        else persos.inventaire.creer({ personnageId: personnage.id, libelle: objet.libelle, quantite, notes: pourNotes(objet.description), ficheId: objet.ficheId, le: iso() })
        noterPrise(butin.id, demandeurId, `${quantite} × ${objet.libelle}`)
      })
    },

    prendrePieces({ demandeurId, campagneId, butinId, pieces }) {
      transaction(db, () => {
        const { butin, personnage } = exigerPrisePossible(demandeurId, campagneId, butinId)
        const demande = bourseSeule(pieces)
        exigerSansErreur(erreurPrisePieces(butin.pieces, demande))
        exiger(!erreurBourse(additionner(personnage.bourse, demande)), erreurs.requeteInvalide('Ta bourse ne peut pas contenir autant de pièces.'))
        persos.butins.retirerPieces(butin.id, demande)
        persos.personnages.ajouterPieces(personnage.id, demande, iso())
        noterPrise(butin.id, demandeurId, decrirePieces(demande))
      })
    },

    /** Vérifie les butins d'un fichier d'import avant que quoi que ce soit ne soit écrit. */
    verifierButinsImportes(butins = []) {
      exiger(Array.isArray(butins), erreurs.requeteInvalide('Fichier invalide : « butins » doit être une liste.'))
      for (const b of butins) {
        exigerSansErreur(erreurButin({ titre: String(b?.titre ?? '').trim(), notesMj: b?.notesMj ?? '', pieces: bourseSeule(b?.pieces) }))
        for (const o of b.objets ?? []) exigerSansErreur(erreurObjetButin({ libelle: o?.nom, quantite: o?.quantite, description: o?.description ?? '' }))
      }
    },

    /** Les butins d'un fichier d'import, tous en préparation ; leurs objets sont reliés aux fiches du même nom. */
    importerButins(campagneId, butins = []) {
      const objetsParNom = bibliotheque.objetsParNom(campagneId)
      transaction(db, () => {
        for (const b of butins) importerUnButin(campagneId, b, objetsParNom)
      })
      return butins.length
    },

    /** Un membre retiré de la campagne n'y garde pas sa fiche. */
    oublierPersonnageDe(utilisateurId, campagneId) {
      persos.personnages.supprimerCeluiDe(utilisateurId, campagneId)
    },

    /** Part de l'export RGPD : fiches, bourse, inventaire, Marques et prises dans les butins. */
    donneesPersonnagesDe(utilisateurId) {
      return {
        personnages: persos.personnages.duJoueur(utilisateurId).map((p) => ({
          campagne: p.campagne,
          fiche: p.fiche,
          bourse: p.bourse,
          inventaire: persos.inventaire.du(p.id).map(({ libelle, quantite, notes }) => ({ libelle, quantite, notes })),
          marques: persos.marques.du(p.id).map(({ titre, don, prix, creeLe }) => ({ titre, don, prix, creeLe })),
          creeLe: p.creeLe,
          majLe: p.majLe,
        })),
        prises: persos.prises.de(utilisateurId),
      }
    },
  }
}
