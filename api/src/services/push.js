import webpush from 'web-push'
import { CATEGORIES, CLES_CATEGORIES, estAdressePushAutorisee } from '../../../src/domain/notifications.js'
import { erreurs } from '../domaine/erreurs.js'
import { transaction } from '../infra/base.js'
import { creerDepotsPush } from '../infra/depotsPush.js'

const MAX_APPAREILS = 10
const PAR_TOURNEE = 100
/** Envois menés de front, et durée maximale d'un envoi : un service push lent ne bloque pas les autres. */
const EN_PARALLELE = 8
const DUREE_MAX_ENVOI_MS = 15_000
const LONGUEUR_APPAREIL = 60
/** Une clé publique P-256 non compressée (65 octets) et un secret de 16 octets, en base64url. */
const CLE_P256DH = /^[A-Za-z0-9_-]{87}$/
const CLE_AUTH = /^[A-Za-z0-9_-]{22}$/
/** Combien de temps un service push garde un message pour un appareil éteint. */
const DUREE_DE_VIE_S = 24 * 60 * 60

/** Envoi réel, par le protocole Web Push (messages chiffrés de bout en bout entre le serveur et le navigateur). */
export function envoyeurWebPush({ contact }) {
  // Les services push exigent un contact en https: ou mailto: ; en développement (http://localhost), une adresse neutre.
  const sujet = /^(https:|mailto:)/.test(contact) ? contact : 'mailto:portail@eldaria.invalid'
  return async ({ abonnement, charge, cles }) => {
    try {
      const reponse = await webpush.sendNotification(abonnement, charge, {
        vapidDetails: { subject: sujet, publicKey: cles.publique, privateKey: cles.privee },
        TTL: DUREE_DE_VIE_S,
        timeout: 10_000,
      })
      return { statut: reponse.statusCode }
    } catch (erreur) {
      return { statut: erreur.statusCode ?? 0 }
    }
  }
}

/**
 * Les notifications sur les appareils : clés du serveur, abonnements des navigateurs, choix de chacun,
 * et l'envoi des notifications en attente (appelé régulièrement par le serveur, jamais pendant une requête).
 */
/** Un envoi qui ne répond pas à temps compte comme un échec, sans retenir la tournée. */
function avecDelai(promesse, delaiMs) {
  let minuteur
  const delai = new Promise((resoudre) => { minuteur = setTimeout(() => resoudre({ statut: 0 }), delaiMs) })
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur))
}

export function creerPush({ db, maintenant, envoyeur, delaiEnvoiMs = DUREE_MAX_ENVOI_MS }) {
  const push = creerDepotsPush(db)
  const iso = () => maintenant().toISOString()

  function exiger(condition, erreur) {
    if (!condition) throw erreur
  }

  /** Les clés VAPID du serveur, créées au premier besoin et gardées dans la base. */
  function cles() {
    const existantes = push.reglages.lire('vapid')
    if (existantes) return JSON.parse(existantes)
    const { publicKey, privateKey } = webpush.generateVAPIDKeys()
    push.reglages.ecrireSiAbsent('vapid', JSON.stringify({ publique: publicKey, privee: privateKey }))
    return JSON.parse(push.reglages.lire('vapid'))
  }

  const coupees = (utilisateurId) => new Set(push.preferences.coupees(utilisateurId))

  return {
    clePubliquePush() {
      return cles().publique
    },

    abonnerAppareil({ utilisateurId, abonnement, appareil = '' }) {
      const adresse = abonnement?.endpoint
      exiger(typeof adresse === 'string' && adresse.length <= 1000 && estAdressePushAutorisee(adresse),
        erreurs.requeteInvalide('Ce navigateur propose un service de notifications inconnu.'))
      const { p256dh, auth } = abonnement.keys ?? {}
      exiger(CLE_P256DH.test(p256dh ?? '') && CLE_AUTH.test(auth ?? ''), erreurs.requeteInvalide('Abonnement aux notifications invalide.'))
      const nom = String(appareil ?? '').slice(0, LONGUEUR_APPAREIL)
      transaction(db, () => {
        push.abonnements.enregistrer({ utilisateurId, adresse, p256dh, auth, appareil: nom, le: iso() })
        push.abonnements.garderLesPlusRecents(utilisateurId, MAX_APPAREILS)
      })
    },

    /** Ce navigateur est-il abonné pour ce compte ? (Le navigateur peut se croire abonné alors que le serveur l'a oublié.) */
    appareilAbonne({ utilisateurId, adresse }) {
      return push.abonnements.de(utilisateurId).some((a) => a.adresse === adresse)
    },

    /** Désabonnement d'un navigateur par son adresse (bouton « Couper sur cet appareil »). */
    desabonnerAppareil({ utilisateurId, adresse }) {
      push.abonnements.supprimerParAdresse(utilisateurId, String(adresse ?? ''))
    },

    appareilsPush({ utilisateurId }) {
      return push.abonnements.de(utilisateurId).map(({ id, appareil, creeLe, dernierEnvoiLe }) => ({ id, appareil, creeLe, dernierEnvoiLe }))
    },

    retirerAppareil({ utilisateurId, appareilId }) {
      exiger(push.abonnements.supprimer(appareilId, utilisateurId), erreurs.introuvable('Appareil'))
    },

    preferencesPush({ utilisateurId }) {
      const sans = coupees(utilisateurId)
      return CATEGORIES.map((c) => ({ ...c, actif: !sans.has(c.cle) }))
    },

    /** `actives` : les catégories que l'utilisateur veut recevoir sur ses appareils ; les autres sont coupées. */
    changerPreferencesPush({ utilisateurId, actives }) {
      exiger(Array.isArray(actives) && actives.every((c) => CLES_CATEGORIES.includes(c)), erreurs.requeteInvalide('Catégorie de notification inconnue.'))
      push.preferences.remplacer(utilisateurId, CLES_CATEGORIES.filter((c) => !actives.includes(c)))
    },

    /**
     * Envoie les notifications en attente aux appareils de leurs destinataires, selon leurs choix.
     * Chaque notification est d'abord marquée comme traitée : un envoi qui échoue n'est pas retenté indéfiniment.
     */
    async envoyerPushEnAttente() {
      const enAttente = push.file.prendre(PAR_TOURNEE)
      if (!enAttente.length) return { envoyes: 0, echecs: 0 }
      const clesServeur = cles()
      const taches = enAttente
        .filter((n) => !coupees(n.utilisateurId).has(n.categorie))
        .flatMap((notification) => {
          const charge = JSON.stringify({ titre: notification.campagne, texte: notification.texte, lien: notification.lien })
          return push.abonnements.de(notification.utilisateurId).map((abonnement) => ({ abonnement, charge }))
        })
      let envoyes = 0
      let echecs = 0
      const envoyerUn = async ({ abonnement, charge }) => {
        const { statut } = await avecDelai(envoyeur({
          abonnement: { endpoint: abonnement.adresse, keys: { p256dh: abonnement.p256dh, auth: abonnement.auth } }, charge, cles: clesServeur,
        }), delaiEnvoiMs)
        if (statut >= 200 && statut < 300) {
          envoyes += 1
          push.abonnements.noterEnvoi(abonnement.id, iso())
        } else {
          echecs += 1
          // 404 ou 410 : le navigateur a retiré son abonnement, il ne servira plus.
          if (statut === 404 || statut === 410) push.abonnements.supprimer(abonnement.id, abonnement.utilisateurId)
        }
      }
      for (let i = 0; i < taches.length; i += EN_PARALLELE) await Promise.all(taches.slice(i, i + EN_PARALLELE).map(envoyerUn))
      return { envoyes, echecs }
    },

    /** Part de l'export RGPD : les appareils (le service utilisé, jamais l'adresse ni les clés) et les catégories coupées. */
    donneesPushDe(utilisateurId) {
      return {
        notificationsPush: {
          appareils: push.abonnements.de(utilisateurId).map(({ appareil, adresse, creeLe, dernierEnvoiLe }) => ({
            appareil, service: new URL(adresse).hostname, creeLe, dernierEnvoiLe,
          })),
          categoriesCoupees: CLES_CATEGORIES.filter((c) => coupees(utilisateurId).has(c)),
        },
      }
    },
  }
}
