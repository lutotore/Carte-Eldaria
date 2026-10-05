import { describe, expect, it } from 'vitest'
import { appDeTest, inscrireParHttp, requete } from './aides.js'

const bourse = (x = {}) => ({ pp: 0, po: 0, pe: 0, pa: 0, pc: 0, ...x })

async function avecJoueurs() {
  const outils = await appDeTest()
  const { app, cookieTom, campagneId } = outils
  const cookieLea = await inscrireParHttp(app, { campagneId, cookieProprietaire: cookieTom, identifiant: 'lea', role: 'joueur' })
  const cookieMax = await inscrireParHttp(app, { campagneId, cookieProprietaire: cookieTom, identifiant: 'max', role: 'joueur' })
  const base = `/api/campagnes/${campagneId}`
  const appel = (cookie, method, chemin, payload) => requete(app, { method, url: `${base}${chemin}`, cookie, payload })
  return { ...outils, cookieLea, cookieMax, base, appel }
}

describe('fiches de personnage par HTTP', () => {
  it('le joueur crée, remplit et lit sa fiche ; un autre joueur ne la voit pas', async () => {
    const { appel, cookieLea, cookieMax, cookieTom } = await avecJoueurs()
    const creation = await appel(cookieLea, 'POST', '/personnages', { nom: 'Isaure' })
    expect(creation.statusCode).toBe(201)
    const { personnageId } = creation.json()
    expect((await appel(cookieLea, 'PUT', `/personnages/${personnageId}`, { champs: { niveau: 3, classe: 'Roublarde' } })).statusCode).toBe(204)
    expect((await appel(cookieLea, 'GET', '/personnages')).json()).toEqual({ estMj: false, personnageId })
    expect((await appel(cookieLea, 'GET', `/personnages/${personnageId}`)).json()).toMatchObject({ fiche: { nom: 'Isaure', niveau: 3 } })
    expect((await appel(cookieMax, 'GET', `/personnages/${personnageId}`)).statusCode).toBe(404)
    expect((await appel(cookieTom, 'GET', '/personnages')).json().personnages).toHaveLength(1)
  })

  it('refuse un champ invalide (400), une bourse périmée (409) et une Marque écrite par le joueur (403)', async () => {
    const { appel, cookieLea } = await avecJoueurs()
    const { personnageId } = (await appel(cookieLea, 'POST', '/personnages', { nom: 'Isaure' })).json()
    expect((await appel(cookieLea, 'PUT', `/personnages/${personnageId}`, { champs: { niveau: 99 } })).statusCode).toBe(400)
    expect((await appel(cookieLea, 'PUT', `/personnages/${personnageId}/bourse`, { avant: bourse({ po: 3 }), apres: bourse() })).statusCode).toBe(409)
    expect((await appel(cookieLea, 'POST', `/personnages/${personnageId}/marques`, { titre: 'x' })).statusCode).toBe(403)
  })

  it("ne laisse pas le corps de la requête remplacer le demandeur", async () => {
    const { appel, cookieLea, cookieMax } = await avecJoueurs()
    const { personnageId } = (await appel(cookieLea, 'POST', '/personnages', { nom: 'Isaure' })).json()
    const tentative = await appel(cookieMax, 'POST', `/personnages/${personnageId}/inventaire`, { libelle: 'Piège', quantite: 1, demandeurId: 1, personnageId })
    expect(tentative.statusCode).toBe(404)
    expect((await appel(cookieLea, 'GET', `/personnages/${personnageId}`)).json().inventaire).toEqual([])
  })
})

describe('butins par HTTP', () => {
  it('le MJ prépare et ouvre, le joueur prend un objet et des pièces', async () => {
    const { appel, cookieTom, cookieLea } = await avecJoueurs()
    const { personnageId } = (await appel(cookieLea, 'POST', '/personnages', { nom: 'Isaure' })).json()
    const { butinId } = (await appel(cookieTom, 'POST', '/butins', { titre: 'La chapelle', notesMj: 'secret', pieces: bourse({ po: 10 }) })).json()
    const { objetId } = (await appel(cookieTom, 'POST', `/butins/${butinId}/objets`, { libelle: 'Potion de soins', quantite: 2, description: '' })).json()
    expect((await appel(cookieLea, 'GET', '/butins')).json().butins).toEqual([])
    expect((await appel(cookieTom, 'PUT', `/butins/${butinId}/statut`, { statut: 'ouvert' })).statusCode).toBe(204)

    expect((await appel(cookieLea, 'POST', `/butins/${butinId}/objets/${objetId}/prise`, { quantite: 1 })).statusCode).toBe(204)
    expect((await appel(cookieLea, 'POST', `/butins/${butinId}/pieces/prise`, { pieces: bourse({ po: 4 }) })).statusCode).toBe(204)
    const fiche = (await appel(cookieLea, 'GET', `/personnages/${personnageId}`)).json()
    expect(fiche.bourse).toEqual(bourse({ po: 4 }))
    expect(fiche.inventaire).toMatchObject([{ libelle: 'Potion de soins', quantite: 1 }])
    const vue = (await appel(cookieLea, 'GET', '/butins')).json().butins[0]
    expect(vue).not.toHaveProperty('notesMj')
    expect(vue.pieces.po).toBe(6)
  })

  it('refuse aux joueurs de préparer un butin', async () => {
    const { appel, cookieLea } = await avecJoueurs()
    expect((await appel(cookieLea, 'POST', '/butins', { titre: 'x', pieces: bourse() })).statusCode).toBe(403)
  })
})
