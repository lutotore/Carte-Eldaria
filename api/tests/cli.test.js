import { describe, expect, it } from 'vitest'
import { executerCommande } from '../src/cli.js'
import { campagneAvecProprietaire, etatExemple, MDP, portailDeTest } from './services/aides.js'

const ORIGINE = 'https://eldaria.exemple.fr'

function lancer(portail, args, entree = '', fichiers = {}) {
  const lignes = []
  const resultat = executerCommande(args, {
    portail,
    origine: ORIGINE,
    lireEntree: async () => entree,
    lireFichier: async (chemin) => fichiers[chemin],
    ecrire: (l) => lignes.push(l),
  })
  return resultat.then(() => lignes.join('\n'))
}

describe('ligne de commande du serveur', () => {
  it('initialise une campagne et donne le lien du propriétaire', async () => {
    const { portail } = portailDeTest()
    const sortie = await lancer(portail, ['initialiser', 'Eldaria'])
    expect(sortie).toMatch(/Campagne n° 1 créée/)
    const jeton = sortie.match(/invitation\/([A-Za-z0-9_-]{43})/)[1]
    expect(portail.decrireInvitation(jeton)).toEqual({ campagne: 'Eldaria', role: 'proprietaire' })
  })

  it("importe l'état depuis l'entrée standard puis le réexporte", async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    await lancer(portail, ['importer-etat', String(campagneId)], JSON.stringify(etatExemple()))
    expect(portail.lireEtat({ demandeurId: tomId, campagneId }).etat.horloge).toBe(3)
    expect(JSON.parse(await lancer(portail, ['exporter-etat', String(campagneId)])).iles.aeronis.nom).toBe('Aéronis')
  })

  it("importe l'état depuis un fichier (pratique sous Windows)", async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    await lancer(portail, ['importer-etat', String(campagneId), 'mj/etat.json'], '', { 'mj/etat.json': JSON.stringify(etatExemple()) })
    expect(portail.lireEtat({ demandeurId: tomId, campagneId }).etat.session).toBe(2)
  })

  it('dépanne un propriétaire qui a perdu son mot de passe', async () => {
    const { portail } = portailDeTest()
    await campagneAvecProprietaire(portail)
    const sortie = await lancer(portail, ['reinitialiser', 'tom'])
    const jeton = sortie.match(/reinitialisation\/([A-Za-z0-9_-]{43})/)[1]
    await portail.reinitialiser(jeton, 'mot de passe retrouvé')
    await expect(portail.connecter({ identifiant: 'tom', motDePasse: 'mot de passe retrouvé' })).resolves.toBeDefined()
    await expect(portail.connecter({ identifiant: 'tom', motDePasse: MDP })).rejects.toBeDefined()
  })

  it('importe des fiches de PNJ depuis un fichier', async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const fichier = JSON.stringify({ version: 1, fiches: [{ type: 'pnj', nom: 'Pip', facettes: { attitude: 'amical' }, secrets: [], notesMj: '' }] })
    const sortie = await lancer(portail, ['importer-fiches', String(campagneId), 'pnj.json'], '', { 'pnj.json': fichier })
    expect(sortie).toMatch(/1 fiche\(s\) importée\(s\), toutes cachées/)
    expect(portail.bibliotheque({ demandeurId: tomId, campagneId }).fiches.map((f) => f.nom)).toEqual(['Pip'])
  })

  it("importe des fiches depuis l'entrée standard (pratique avec docker compose exec -T)", async () => {
    const { portail } = portailDeTest()
    const { campagneId, tomId } = await campagneAvecProprietaire(portail)
    const fichier = JSON.stringify({ version: 1, fiches: [{ type: 'pnj', nom: 'Mila', facettes: {}, secrets: [], notesMj: '' }] })
    await lancer(portail, ['importer-fiches', String(campagneId)], fichier)
    expect(portail.bibliotheque({ demandeurId: tomId, campagneId }).fiches.map((f) => f.nom)).toEqual(['Mila'])
  })

  it('refuse une commande inconnue en affichant l’aide', async () => {
    const { portail } = portailDeTest()
    await expect(lancer(portail, ['danser'])).rejects.toThrow(/Commandes disponibles/)
  })
})
