import { ref } from 'vue'

/** État d'un formulaire : envoi en cours et message d'erreur à afficher. */
export function utiliserEnvoi() {
  const enCours = ref(false)
  const erreur = ref('')

  async function envoyer(action) {
    if (enCours.value) return undefined
    enCours.value = true
    erreur.value = ''
    try {
      return await action()
    } catch (e) {
      erreur.value = e.message
      return undefined
    } finally {
      enCours.value = false
    }
  }

  return { enCours, erreur, envoyer }
}
