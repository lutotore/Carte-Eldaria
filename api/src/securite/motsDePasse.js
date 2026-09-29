import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/**
 * Hachage des mots de passe avec scrypt (inclus dans Node, aucune dépendance native).
 * Paramètres par défaut : recommandation OWASP (N = 2^17, r = 8, p = 1).
 * L'empreinte embarque ses paramètres : on peut durcir le coût plus tard
 * sans invalider les mots de passe déjà enregistrés.
 */
const PAR_DEFAUT = { N: 2 ** 17, r: 8, p: 1 }
const LONGUEUR_CLE = 64

function deriver(motDePasse, sel, { N, r, p }) {
  // scrypt demande environ 128 * N * r octets de mémoire.
  const maxmem = 256 * N * r
  return new Promise((ok, ko) => {
    scrypt(motDePasse.normalize('NFC'), sel, LONGUEUR_CLE, { N, r, p, maxmem }, (erreur, cle) => (erreur ? ko(erreur) : ok(cle)))
  })
}

export async function hacherMotDePasse(motDePasse, parametres = {}) {
  const cout = { ...PAR_DEFAUT, ...parametres }
  const sel = randomBytes(16)
  const cle = await deriver(motDePasse, sel, cout)
  return ['scrypt', cout.N, cout.r, cout.p, sel.toString('base64'), cle.toString('base64')].join('$')
}

export async function verifierMotDePasse(motDePasse, empreinte) {
  const morceaux = String(empreinte).split('$')
  if (morceaux.length !== 6 || morceaux[0] !== 'scrypt') return false
  const [, N, r, p, sel, attendu] = morceaux
  const cle = await deriver(motDePasse, Buffer.from(sel, 'base64'), { N: Number(N), r: Number(r), p: Number(p) })
  const reference = Buffer.from(attendu, 'base64')
  // Comparaison à temps constant : la durée ne trahit pas le nombre d'octets corrects.
  return reference.length === cle.length && timingSafeEqual(reference, cle)
}
