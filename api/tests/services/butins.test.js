import { describe, expect, it } from 'vitest'
import { campagneAvecProprietaire, inscrire, portailDeTest } from './aides.js'

const bourse = (x = {}) => ({ pp: 0, po: 0, pe: 0, pa: 0, pc: 0, ...x })
const refus = (code) => expect.objectContaining({ code })

async function table() {
  const outils = portailDeTest()
  const { portail } = outils
  const { campagneId, tomId } = await campagneAvecProprietaire(portail)
  const ids = { tom: tomId }
  for (const [identifiant, role] of [['lea', 'joueur'], ['max', 'joueur'], ['ocre', 'occasionnel']]) {
    ids[identifiant] = await inscrire(portail, { campagneId, proprietaireId: tomId, identifiant, role })
  }
  const qui = (nom) => ({ demandeurId: ids[nom], campagneId })
  const persos = {
    lea: portail.creerPersonnage({ ...qui('lea'), nom: 'Isaure' }).personnageId,
    max: portail.creerPersonnage({ ...qui('max'), nom: 'Bram' }).personnageId,
  }
  portail.importerFiches(campagneId, { version: 1, fiches: [
    { type: 'objet', nom: 'Altimètre à Larme', facettes: { apparence: 'Un pendule de cristal.', nature: 'Instrument' }, proprietes: [{ titre: 'Mesure', texte: 'Altitude.' }], secrets: [{ titre: 'Vérité', texte: 'Il mesure le rêve.' }] },
  ] })
  const altimetreId = portail.bibliotheque({ ...qui('tom'), type: 'objet' }).fiches[0].id
  const { butinId } = portail.creerButin({ ...qui('tom'), titre: 'Arc 1 — Mission de Brisemont', notesMj: '20 po chacun', pieces: bourse({ po: 40, pa: 5 }) })
  const potions = portail.ajouterObjetButin({ ...qui('tom'), butinId, libelle: 'Potion de soins', quantite: 4, description: 'Rouge.' }).objetId
  const altimetre = portail.ajouterObjetButin({ ...qui('tom'), butinId, libelle: 'Un pendule de cristal en cage', quantite: 1, description: '', ficheId: altimetreId }).objetId
  const vue = (nom) => portail.butins(qui(nom))
  const inventaire = (nom) => portail.personnage({ ...qui(nom), personnageId: persos[nom] }).inventaire
  const ouvrir = () => portail.changerStatutButin({ ...qui('tom'), butinId, statut: 'ouvert' })
  return { ...outils, campagneId, ids, qui, persos, butinId, potions, altimetre, altimetreId, vue, inventaire, ouvrir }
}

describe('butins : préparation par le MJ', () => {
  it('restent invisibles des joueurs tant qu’ils ne sont pas ouverts', async () => {
    const { vue } = await table()
    expect(vue('lea')).toEqual({ estMj: false, butins: [] })
    const mj = vue('tom')
    expect(mj.estMj).toBe(true)
    expect(mj.butins[0]).toMatchObject({
      titre: 'Arc 1 — Mission de Brisemont', notesMj: '20 po chacun', statut: 'prepare', pieces: bourse({ po: 40, pa: 5 }),
      objets: [{ libelle: 'Potion de soins', quantite: 4 }, { libelle: 'Un pendule de cristal en cage', objet: { nom: 'Altimètre à Larme' } }],
      prises: [],
    })
  })

  it('s’ouvrent : les joueurs sont prévenus et voient le butin, sans les notes du MJ', async () => {
    const { vue, ouvrir, portail, ids, campagneId } = await table()
    ouvrir()
    const butin = vue('ocre').butins[0]
    expect(butin).toMatchObject({ titre: 'Arc 1 — Mission de Brisemont', pieces: bourse({ po: 40, pa: 5 }) })
    expect(butin).not.toHaveProperty('notesMj')
    // Le joueur ne voit que le libellé, pas la fiche de l'objet tant qu'il n'en sait rien.
    expect(butin.objets[1]).toMatchObject({ libelle: 'Un pendule de cristal en cage', objet: null })
    expect(portail.notifications({ demandeurId: ids.lea }).liste[0]).toMatchObject({
      texte: 'Butin à partager : Arc 1 — Mission de Brisemont.', lien: `/campagne/${campagneId}/butins`,
    })
  })

  it('se ferment : ils disparaissent de la vue des joueurs', async () => {
    const { vue, ouvrir, portail, qui, butinId } = await table()
    ouvrir()
    portail.changerStatutButin({ ...qui('tom'), butinId, statut: 'clos' })
    expect(vue('lea').butins).toEqual([])
    expect(() => portail.changerStatutButin({ ...qui('tom'), butinId, statut: 'perdu' })).toThrow(refus('requete_invalide'))
  })

  it('se modifient et se suppriment par les MJ seulement', async () => {
    const { portail, qui, butinId, potions, vue } = await table()
    portail.modifierButin({ ...qui('tom'), butinId, titre: 'Mission', notesMj: '', pieces: bourse({ po: 80 }) })
    portail.modifierObjetButin({ ...qui('tom'), butinId, objetId: potions, libelle: 'Potion de soins', quantite: 2, description: '' })
    expect(vue('tom').butins[0]).toMatchObject({ titre: 'Mission', pieces: bourse({ po: 80 }), objets: [{ quantite: 2 }, {}] })
    expect(() => portail.creerButin({ ...qui('lea'), titre: 'x', notesMj: '', pieces: bourse() })).toThrow(refus('interdit'))
    expect(() => portail.supprimerObjetButin({ ...qui('lea'), butinId, objetId: potions })).toThrow(refus('interdit'))
    portail.modifierObjetButin({ ...qui('tom'), butinId, objetId: potions, libelle: 'Potion de soins', quantite: 0, description: '' })
    portail.supprimerObjetButin({ ...qui('tom'), butinId, objetId: potions })
    portail.supprimerButin({ ...qui('tom'), butinId })
    expect(vue('tom').butins).toEqual([])
  })

  it("ne relient un objet qu'à une fiche d'objet de la campagne", async () => {
    const { portail, qui, butinId, campagneId } = await table()
    portail.importerFiches(campagneId, { version: 1, fiches: [{ type: 'pnj', nom: 'Brisemont' }] })
    const pnjId = portail.bibliotheque({ ...qui('tom'), type: 'pnj' }).fiches[0].id
    expect(() => portail.ajouterObjetButin({ ...qui('tom'), butinId, libelle: 'x', quantite: 1, description: '', ficheId: pnjId })).toThrow(refus('requete_invalide'))
  })
})

describe('butins : les joueurs se servent', () => {
  it('un objet pris passe dans l’inventaire, relié à sa fiche, et le butin en garde trace', async () => {
    const { portail, qui, butinId, potions, altimetre, altimetreId, ouvrir, inventaire, vue } = await table()
    ouvrir()
    portail.prendreObjet({ ...qui('lea'), butinId, objetId: potions, quantite: 2 })
    portail.prendreObjet({ ...qui('lea'), butinId, objetId: potions, quantite: 1 })
    portail.prendreObjet({ ...qui('lea'), butinId, objetId: altimetre, quantite: 1 })
    expect(inventaire('lea')).toEqual([
      expect.objectContaining({ libelle: 'Potion de soins', quantite: 3, notes: 'Rouge.', objet: null }),
      expect.objectContaining({ libelle: 'Un pendule de cristal en cage', quantite: 1, objet: null }),
    ])
    const butin = vue('max').butins[0]
    expect(butin.objets.map((o) => o.quantite)).toEqual([1, 0])
    expect(butin.prises.map((p) => p.texte)).toEqual([
      'lea prend 2 × Potion de soins', 'lea prend 1 × Potion de soins', 'lea prend 1 × Un pendule de cristal en cage',
    ])
    // Dès que le MJ révèle la fiche à son porteur, l'inventaire mène à l'objet identifié.
    const facette = portail.fiche({ ...qui('tom'), ficheId: altimetreId }).facettes.find((f) => f.cle === 'nom')
    portail.reveler({ ...qui('tom'), ficheId: altimetreId, facetteId: facette.id, pourTous: false, joueurs: [qui('lea').demandeurId] })
    expect(inventaire('lea')[1].objet).toEqual({ id: altimetreId, nom: 'Altimètre à Larme' })
  })

  it('on ne prend pas plus qu’il n’en reste, ni dans un butin fermé ou en préparation', async () => {
    const { portail, qui, butinId, potions, ouvrir } = await table()
    expect(() => portail.prendreObjet({ ...qui('lea'), butinId, objetId: potions, quantite: 1 })).toThrow(refus('introuvable'))
    ouvrir()
    expect(() => portail.prendreObjet({ ...qui('lea'), butinId, objetId: potions, quantite: 5 })).toThrow(refus('requete_invalide'))
    expect(() => portail.prendreObjet({ ...qui('lea'), butinId, objetId: potions, quantite: 0 })).toThrow(refus('requete_invalide'))
    portail.changerStatutButin({ ...qui('tom'), butinId, statut: 'clos' })
    expect(() => portail.prendreObjet({ ...qui('lea'), butinId, objetId: potions, quantite: 1 })).toThrow(refus('introuvable'))
  })

  it('il faut une fiche de personnage pour se servir, et les MJ ne se servent pas', async () => {
    const { portail, qui, butinId, potions, ouvrir } = await table()
    ouvrir()
    expect(() => portail.prendreObjet({ ...qui('ocre'), butinId, objetId: potions, quantite: 1 })).toThrow(refus('requete_invalide'))
    expect(() => portail.prendreObjet({ ...qui('tom'), butinId, objetId: potions, quantite: 1 })).toThrow(refus('interdit'))
  })

  it('une ligne pleine ne déborde pas : une nouvelle ligne prend la suite', async () => {
    const { portail, qui, butinId, ouvrir, inventaire } = await table()
    const fleches = portail.ajouterObjetButin({ ...qui('tom'), butinId, libelle: 'Flèche', quantite: 9999, description: '' }).objetId
    const encore = portail.ajouterObjetButin({ ...qui('tom'), butinId, libelle: 'Flèche', quantite: 5, description: '' }).objetId
    ouvrir()
    portail.prendreObjet({ ...qui('lea'), butinId, objetId: fleches, quantite: 9999 })
    portail.prendreObjet({ ...qui('lea'), butinId, objetId: encore, quantite: 5 })
    expect(inventaire('lea').filter((l) => l.libelle === 'Flèche').map((l) => l.quantite)).toEqual([9999, 5])
  })

  it("refuse une prise de pièces qui ferait déborder la bourse", async () => {
    const { portail, qui, butinId, persos } = await table()
    portail.modifierButin({ ...qui('tom'), butinId, titre: 'Trésor', notesMj: '', pieces: bourse({ po: 1_000_000_000 }) })
    portail.changerStatutButin({ ...qui('tom'), butinId, statut: 'ouvert' })
    portail.changerBourse({ ...qui('lea'), personnageId: persos.lea, avant: bourse(), apres: bourse({ po: 1 }) })
    expect(() => portail.prendrePieces({ ...qui('lea'), butinId, pieces: bourse({ po: 1_000_000_000 }) })).toThrow(refus('requete_invalide'))
  })

  it('les pièces prises passent du butin à la bourse', async () => {
    const { portail, qui, butinId, ouvrir, vue, persos } = await table()
    ouvrir()
    portail.prendrePieces({ ...qui('lea'), butinId, pieces: bourse({ po: 20, pa: 5 }) })
    expect(portail.personnage({ ...qui('lea'), personnageId: persos.lea }).bourse).toEqual(bourse({ po: 20, pa: 5 }))
    expect(vue('max').butins[0]).toMatchObject({ pieces: bourse({ po: 20 }), prises: [{ texte: 'lea prend 20 po, 5 pa' }] })
    expect(() => portail.prendrePieces({ ...qui('max'), butinId, pieces: bourse({ po: 21 }) })).toThrow(refus('requete_invalide'))
  })
})

describe('butins : import et données personnelles', () => {
  it("s'importent avec les fiches d'objets, reliés par leur nom", async () => {
    const { portail, qui, campagneId } = await table()
    const { butins } = portail.importerFiches(campagneId, {
      version: 1,
      fiches: [{ type: 'objet', nom: 'Insigne de recrue', facettes: { apparence: 'Un insigne.' } }],
      butins: [{
        titre: 'Arc 2 — La chapelle', notesMj: '1 par PJ', pieces: bourse({ po: 5 }),
        objets: [{ nom: 'Potion de soins', quantite: 4, description: '' }, { nom: 'Insigne de recrue', quantite: 1, description: 'Signé.' }],
      }],
    })
    expect(butins).toBe(1)
    const importe = portail.butins(qui('tom')).butins.find((b) => b.titre === 'Arc 2 — La chapelle')
    expect(importe).toMatchObject({ statut: 'prepare', notesMj: '1 par PJ', pieces: bourse({ po: 5 }) })
    expect(importe.objets.map((o) => [o.libelle, o.quantite, o.objet?.nom ?? null])).toEqual([
      ['Potion de soins', 4, null], ['Insigne de recrue', 1, 'Insigne de recrue'],
    ])
  })

  it("refuse le fichier entier si un butin est invalide, sans rien importer", async () => {
    const { portail, qui, campagneId } = await table()
    const avant = portail.bibliotheque({ ...qui('tom'), type: 'objet' }).fiches.length
    expect(() => portail.importerFiches(campagneId, {
      version: 1, fiches: [{ type: 'objet', nom: 'Neuf' }], butins: [{ titre: '', pieces: bourse(), objets: [] }],
    })).toThrow(refus('requete_invalide'))
    expect(portail.bibliotheque({ ...qui('tom'), type: 'objet' }).fiches.length).toBe(avant)
  })

  it('les prises du joueur sont dans son export', async () => {
    const { portail, qui, butinId, potions, ouvrir, ids } = await table()
    ouvrir()
    portail.prendreObjet({ ...qui('lea'), butinId, objetId: potions, quantite: 1 })
    expect(portail.exporterDonnees(ids.lea).prises).toEqual([
      { campagne: 'Eldaria', butin: 'Arc 1 — Mission de Brisemont', texte: 'lea prend 1 × Potion de soins', le: expect.any(String) },
    ])
  })
})
