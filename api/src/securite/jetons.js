import { createHash, randomBytes } from 'node:crypto'

/** 32 octets aléatoires, encodés pour pouvoir figurer dans une URL. */
export function genererJeton() {
  return randomBytes(32).toString('base64url')
}

/**
 * La base ne stocke que l'empreinte d'un jeton (session, invitation…).
 * Une fuite de la base ne donne donc accès à aucun compte.
 */
export function empreinteJeton(jeton) {
  return createHash('sha256').update(String(jeton)).digest('base64url')
}
