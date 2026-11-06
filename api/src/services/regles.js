import { creerCatalogue, erreurCatalogue } from '../../../src/domain/regles/catalogue.js'
import { ELEMENTS_SRD } from '../../../src/domain/regles/srd.js'
import { erreurs } from '../domaine/erreurs.js'
import { transaction } from '../infra/base.js'

const LONGUEUR_LIVRE = 120

/**
 * Règles du jeu : le SRD, plus les livres que le MJ possède, importés en ligne de commande depuis mj/.
 * Le contenu des livres ne vit que dans la base du serveur, jamais dans le dépôt public.
 */
export function creerRegles({ db }) {
  let catalogue = null
  const lignes = () => db.prepare('SELECT livre, contenu FROM regles_elements ORDER BY id').all()
  const elementsDesLivres = ({ sauf = null } = {}) => lignes().filter((l) => l.livre !== sauf).map((l) => JSON.parse(l.contenu))

  function exigerSansErreur(probleme) {
    if (probleme) throw erreurs.requeteInvalide(probleme)
  }

  return {
    /** Le catalogue complet, gardé en mémoire jusqu'au prochain import. */
    catalogue() {
      catalogue ??= creerCatalogue([...ELEMENTS_SRD, ...elementsDesLivres()])
      return catalogue
    },

    /** Remplace les éléments d'un livre, après avoir vérifié que l'ensemble des règles reste cohérent. */
    importerRegles({ livre, elements } = {}) {
      const nom = String(livre ?? '').trim()
      exigerSansErreur(!nom || nom.length > LONGUEUR_LIVRE ? 'Indique le nom du livre (« livre »).' : null)
      exigerSansErreur(Array.isArray(elements) ? null : 'Fichier invalide : « elements » doit être une liste.')
      exigerSansErreur(erreurCatalogue([...ELEMENTS_SRD, ...elementsDesLivres({ sauf: nom }), ...elements]))
      transaction(db, () => {
        db.prepare('DELETE FROM regles_elements WHERE livre = ?').run(nom)
        const inserer = db.prepare('INSERT INTO regles_elements (livre, contenu) VALUES (?, ?)')
        for (const element of elements) inserer.run(nom, JSON.stringify(element))
      })
      catalogue = null
      return { nombre: elements.length }
    },

    livresDeRegles() {
      return db.prepare('SELECT livre, COUNT(*) AS nombre FROM regles_elements GROUP BY livre ORDER BY livre').all()
        .map(({ livre, nombre }) => ({ livre, nombre }))
    },
  }
}
