import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { differencesImport, ficheDepuisAideDD, lireXmlAideDD } from '../../src/domain/aideDD.js'
import { erreurChamps, ficheVierge } from '../../src/domain/personnage.js'

const IVAN = readFileSync(new URL('../fixtures/ivan-aide-dd.xml', import.meta.url), 'utf8')

/** Un XML aide-dd minimal, pour tester un champ à la fois. */
const xml = (personnage) => `<?xml version="1.0" encoding="UTF-8"?><builder><character>${personnage}</character></builder>`
const BASE = '<name>Test</name><class>Guerrier</class><level>1</level><race>Humain (don)</race>'
  + '<str>10</str><dex>10</dex><con>10</con><int>10</int><wis>10</wis><cha>10</cha>'

describe('lireXmlAideDD : le fichier tel quel', () => {
  it('lit les balises simples, les niveaux et les listes numérotées', () => {
    const lu = lireXmlAideDD(IVAN)
    expect(lu.name).toBe('Ivan')
    expect(lu.str).toBe('14')
    expect(lu.lvl['1']).toMatchObject({ hp_brut: '12', aug_carac0: '0', aug_carac1: '2', feat: 'Maître des armes à deux mains' })
    expect(lu.skillsProf).toEqual({ 0: '0', 1: '2,11', 2: '2,7', 3: '' })
    expect(lu.languages['0']).toBe('commun,elfique')
  })

  it('décode les entités XML', () => {
    expect(lireXmlAideDD(xml('<name>Tom &amp; Jerry &lt;3</name>')).name).toBe('Tom & Jerry <3')
  })

  it('refuse ce qui n’est pas un export aide-dd', () => {
    expect(() => lireXmlAideDD('<html><body>nope</body></html>')).toThrow(/aide-dd/)
    expect(() => lireXmlAideDD('')).toThrow(/aide-dd/)
  })
})

describe('ficheDepuisAideDD : Ivan, barbare de niveau 2', () => {
  const { champs, avertissements } = ficheDepuisAideDD(IVAN)

  it('reprend l’identité', () => {
    expect(champs).toMatchObject({ nom: 'Ivan', classe: 'Barbare', niveau: 2, espece: 'Humain (don)', historique: 'Soldat', xp: 0 })
  })

  it('ajoute aux caractéristiques les augmentations choisies jusqu’à son niveau', () => {
    expect(champs.caracteristiques).toEqual({ for: 15, dex: 15, con: 17, int: 9, sag: 10, cha: 12 })
  })

  it('déduit les sauvegardes, le dé de vie et les PV de la classe', () => {
    expect(champs.sauvegardes).toEqual(['for', 'con'])
    expect(champs.desDeVie).toBe('2d12')
    // 12 + 7 aux dés, plus 2 niveaux × 3 de Constitution
    expect(champs.pvMax).toBe(25)
    expect(champs.pvActuels).toBe(25)
  })

  it('coche les compétences de l’espèce, de la classe et de l’historique', () => {
    expect(champs.competences).toEqual({ acrobaties: 1, athletisme: 1, intimidation: 1, perception: 1 })
  })

  it('range langues, outils, dons et apparence dans les champs texte', () => {
    expect(champs.langues).toBe('Commun, elfique')
    expect(champs.maitrises).toBe('Outils : dés, véhicules (terrestres)')
    expect(champs.capacites).toBe('Don : Maître des armes à deux mains')
    expect(champs.apparence).toBe('20 ans · 1,75 m · 80 kg')
  })

  it('ne touche ni à la CA ni à l’équipement, et le dit', () => {
    expect(champs).not.toHaveProperty('ca')
    expect(avertissements.join(' ')).toMatch(/CA/)
    expect(avertissements.join(' ')).toMatch(/équipement/)
  })

  it('donne des champs que le portail accepte', () => {
    expect(erreurChamps(champs)).toBeNull()
  })
})

describe('ficheDepuisAideDD : les cas particuliers', () => {
  it('applique les bonus fixes d’une espèce connue, en le signalant', () => {
    const { champs, avertissements } = ficheDepuisAideDD(xml(BASE.replace('Humain (don)', 'Nain des collines')))
    expect(champs.caracteristiques).toMatchObject({ con: 12, sag: 11 })
    expect(champs.pvMax).toBe(10 + 1 + 1) // 1d10 max + Con +1 + ténacité naine
    expect(avertissements.join(' ')).toMatch(/Nain des collines/)
  })

  it('ne devine rien pour une espèce inconnue, et le signale', () => {
    const { champs, avertissements } = ficheDepuisAideDD(xml(BASE.replace('Humain (don)', 'Aarakocra')))
    expect(champs.caracteristiques).toEqual({ for: 10, dex: 10, con: 10, int: 10, sag: 10, cha: 10 })
    expect(avertissements.join(' ')).toMatch(/Aarakocra/)
  })

  it('ignore les niveaux au-delà de celui du personnage', () => {
    const lvl = '<lvl lvl="1"><hp_brut>10</hp_brut></lvl><lvl lvl="4"><hp_brut>6</hp_brut><aug_carac0>0</aug_carac0><aug_carac1>0</aug_carac1></lvl>'
    const { champs } = ficheDepuisAideDD(xml(BASE + lvl))
    expect(champs.caracteristiques.for).toBe(10)
    expect(champs.pvMax).toBe(10)
  })

  it('compte le don Robuste dans les PV', () => {
    const lvl = '<lvl lvl="1"><hp_brut>10</hp_brut><feat>Robuste</feat></lvl>'
    expect(ficheDepuisAideDD(xml(BASE + lvl)).champs.pvMax).toBe(12)
  })

  it('accepte l’artificier, absent des règles libres mais pas de la table', () => {
    const { champs } = ficheDepuisAideDD(xml(BASE.replace('Guerrier', 'Artificier') + '<lvl lvl="1"><hp_brut>8</hp_brut></lvl>'))
    expect(champs.sauvegardes).toEqual(['con', 'int'])
    expect(champs.desDeVie).toBe('1d8')
  })

  it('refuse un fichier sans nom de personnage', () => {
    expect(() => ficheDepuisAideDD(xml('<class>Barde</class>'))).toThrow(/nom/)
  })
})

describe('differencesImport : l’aperçu avant de remplacer', () => {
  it('liste seulement ce qui change, avec des libellés lisibles', () => {
    const actuelle = { ...ficheVierge('Ivan'), classe: 'Barbare' }
    const { champs } = ficheDepuisAideDD(IVAN)
    const diff = differencesImport(actuelle, champs)
    const cles = diff.map((d) => d.cle)
    expect(cles).not.toContain('nom')
    expect(cles).not.toContain('classe')
    expect(diff.find((d) => d.cle === 'niveau')).toEqual({ cle: 'niveau', libelle: 'Niveau', avant: '1', apres: '2' })
    expect(diff.find((d) => d.cle === 'caracteristiques').apres).toBe('FOR 15 · DEX 15 · CON 17 · INT 9 · SAG 10 · CHA 12')
    expect(diff.find((d) => d.cle === 'competences').apres).toBe('Acrobaties, Athlétisme, Intimidation, Perception')
  })
})
