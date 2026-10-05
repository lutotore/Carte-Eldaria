<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../../api/client.js'
import { calculs, CARACTERISTIQUES, COMPETENCES } from '../../domain/personnage.js'

/**
 * La fiche de jeu d'un personnage (D&D 5e). Chaque champ part dès qu'on le quitte ;
 * les valeurs déduites (modificateurs, bonus, Perception passive) se recalculent sur place.
 */
const props = defineProps({
  campagneId: { type: String, required: true },
  personnage: { type: Object, required: true },
})
const emit = defineEmits(['recharger'])

/** Copie de travail : les props, réactives, ne se clonent pas avec structuredClone. */
const copie = (valeur) => JSON.parse(JSON.stringify(valeur))
const fiche = ref(copie(props.personnage.fiche))
/** Fiche reçue pendant un enregistrement : appliquée une fois la file vide, pour ne rien rebâtir sur une valeur périmée. */
let enAttente = null
watch(() => props.personnage, (p) => {
  if (enCours.value > 0) enAttente = p
  else fiche.value = copie(p.fiche)
})
const c = computed(() => calculs(fiche.value))
const erreur = ref('')
const enregistre = ref('')
const enCours = ref(0)

const signe = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)

/** Les enregistrements partent l'un après l'autre : aucun n'est perdu si l'on enchaîne les champs. */
let file = Promise.resolve()
function enregistrer(champs) {
  Object.assign(fiche.value, champs)
  enregistre.value = ''
  erreur.value = ''
  enCours.value += 1
  file = file.then(async () => {
    try {
      await api.modifierPersonnage(props.campagneId, props.personnage.id, champs)
      enregistre.value = 'Enregistré.'
    } catch (e) {
      erreur.value = e.message
      emit('recharger') // la fiche affichée revient à ce que le serveur a gardé
    } finally {
      enCours.value -= 1
      if (enCours.value === 0 && enAttente) {
        fiche.value = copie(enAttente.fiche)
        enAttente = null
      }
    }
  })
  return file
}

const texte = (cle, evenement) => evenement.target.value !== fiche.value[cle] && enregistrer({ [cle]: evenement.target.value })

function nombre(cle, evenement) {
  const valeur = Number(evenement.target.value)
  if (evenement.target.value === '' || !Number.isInteger(valeur)) {
    evenement.target.value = fiche.value[cle]
    return undefined
  }
  return valeur !== fiche.value[cle] && enregistrer({ [cle]: valeur })
}

function caracteristique(cle, evenement) {
  const valeur = Number(evenement.target.value)
  if (!Number.isInteger(valeur) || valeur < 1 || valeur > 30) {
    evenement.target.value = fiche.value.caracteristiques[cle]
    erreur.value = 'Une caractéristique va de 1 à 30.'
    return undefined
  }
  return enregistrer({ caracteristiques: { ...fiche.value.caracteristiques, [cle]: valeur } })
}

function basculerSauvegarde(cle) {
  const liste = fiche.value.sauvegardes
  return enregistrer({ sauvegardes: liste.includes(cle) ? liste.filter((x) => x !== cle) : [...liste, cle] })
}

function maitriseCompetence(cle, evenement) {
  const niveau = Number(evenement.target.value)
  const competences = { ...fiche.value.competences }
  if (niveau === 0) delete competences[cle]
  else competences[cle] = niveau
  return enregistrer({ competences })
}

/** Cocher la 2e case coche la 1re ; décocher la dernière cochée la retire. */
function jetMort(type, rang) {
  const actuel = fiche.value.jetsMort[type]
  return enregistrer({ jetsMort: { ...fiche.value.jetsMort, [type]: actuel === rang ? rang - 1 : rang } })
}

const IDENTITE = [
  { cle: 'classe', libelle: 'Classe' },
  { cle: 'espece', libelle: 'Espèce' },
  { cle: 'historique', libelle: 'Historique' },
  { cle: 'alignement', libelle: 'Alignement' },
]
const TEXTES_COMBAT = [
  { cle: 'attaques', libelle: 'Attaques et incantations', lignes: 4 },
  { cle: 'sorts', libelle: 'Sorts', lignes: 6 },
]
const TEXTES_TRAITS = [
  { cle: 'capacites', libelle: 'Capacités et traits', lignes: 8 },
  { cle: 'langues', libelle: 'Langues', lignes: 2 },
  { cle: 'maitrises', libelle: 'Autres maîtrises (armes, armures, outils)', lignes: 3 },
]
const TEXTES_RECIT = [
  { cle: 'apparence', libelle: 'Apparence', lignes: 3 },
  { cle: 'histoire', libelle: 'Histoire', lignes: 6 },
  { cle: 'notes', libelle: 'Notes', lignes: 6 },
]
const LONGUEURS = { attaques: 4000, sorts: 8000, capacites: 8000, langues: 2000, maitrises: 2000, apparence: 2000, histoire: 8000, notes: 8000 }
const MAITRISES = [{ valeur: 0, nom: '—' }, { valeur: 1, nom: 'Maîtrise' }, { valeur: 2, nom: 'Expertise' }]
</script>

<template>
  <section class="fiche papier epingle" aria-labelledby="nom-personnage">
    <header class="identite">
      <label class="nom">
        <span class="visuellement-cache">Nom du personnage</span>
        <input id="nom-personnage" :value="fiche.nom" maxlength="80" required @change="texte('nom', $event)">
      </label>
      <div class="grille-identite">
        <label v-for="champ in IDENTITE" :key="champ.cle" class="champ">{{ champ.libelle }}
          <input :value="fiche[champ.cle]" maxlength="120" @change="texte(champ.cle, $event)">
        </label>
        <label class="champ court">Niveau <input type="number" min="1" max="20" :value="fiche.niveau" @change="nombre('niveau', $event)"></label>
        <label class="champ court">Points d’expérience <input type="number" min="0" :value="fiche.xp" @change="nombre('xp', $event)"></label>
      </div>
      <p class="statut" aria-live="polite">
        <span v-if="erreur" class="message message--erreur">{{ erreur }}</span>
        <span v-else-if="enregistre && !enCours" class="message message--ok">{{ enregistre }}</span>
      </p>
    </header>

    <div class="colonnes">
      <div class="colonne">
        <div class="caracs">
          <label v-for="k in CARACTERISTIQUES" :key="k.cle" class="carac">
            <span class="nom-carac">{{ k.nom }}</span>
            <strong class="mod">{{ signe(c.modificateurs[k.cle]) }}</strong>
            <input type="number" min="1" max="30" :value="fiche.caracteristiques[k.cle]" :aria-label="`${k.nom} (valeur)`" @change="caracteristique(k.cle, $event)">
          </label>
        </div>
        <p class="petit-cadre"><strong>{{ signe(c.maitrise) }}</strong> Bonus de maîtrise</p>
        <label class="petit-cadre inspiration">
          <input type="checkbox" :checked="fiche.inspiration" @change="enregistrer({ inspiration: $event.target.checked })"> Inspiration
        </label>

        <fieldset class="liste">
          <legend>Jets de sauvegarde</legend>
          <label v-for="k in CARACTERISTIQUES" :key="k.cle" class="ligne">
            <input type="checkbox" :checked="fiche.sauvegardes.includes(k.cle)" @change="basculerSauvegarde(k.cle)">
            <span class="bonus">{{ signe(c.sauvegardes[k.cle]) }}</span> {{ k.nom }}
          </label>
        </fieldset>

        <fieldset class="liste">
          <legend>Compétences</legend>
          <div v-for="comp in COMPETENCES" :key="comp.cle" class="ligne">
            <select :value="fiche.competences[comp.cle] ?? 0" :aria-label="`Maîtrise : ${comp.nom}`" @change="maitriseCompetence(comp.cle, $event)">
              <option v-for="m in MAITRISES" :key="m.valeur" :value="m.valeur">{{ m.nom }}</option>
            </select>
            <span class="bonus">{{ signe(c.competences[comp.cle]) }}</span> {{ comp.nom }}
            <small>({{ CARACTERISTIQUES.find((k) => k.cle === comp.carac).nom.slice(0, 3) }})</small>
          </div>
        </fieldset>
        <p class="petit-cadre"><strong>{{ c.perceptionPassive }}</strong> Sagesse (Perception) passive</p>
      </div>

      <div class="colonne">
        <div class="trio">
          <label class="cadre">Classe d’armure <input type="number" min="0" max="50" :value="fiche.ca" @change="nombre('ca', $event)"></label>
          <p class="cadre">Initiative <strong>{{ signe(c.initiative) }}</strong></p>
          <label class="cadre">Vitesse <input :value="fiche.vitesse" maxlength="60" @change="texte('vitesse', $event)"></label>
        </div>
        <div class="pv">
          <label class="champ">PV maximum <input type="number" min="0" :value="fiche.pvMax" @change="nombre('pvMax', $event)"></label>
          <label class="champ">PV actuels <input type="number" :value="fiche.pvActuels" @change="nombre('pvActuels', $event)"></label>
          <label class="champ">PV temporaires <input type="number" min="0" :value="fiche.pvTemporaires" @change="nombre('pvTemporaires', $event)"></label>
        </div>
        <div class="duo">
          <label class="champ">Dés de vie <input :value="fiche.desDeVie" maxlength="60" placeholder="ex. 3d8" @change="texte('desDeVie', $event)"></label>
          <fieldset class="mort">
            <legend>Jets contre la mort</legend>
            <span>Succès
              <input v-for="r in 3" :key="`s${r}`" type="checkbox" :checked="fiche.jetsMort.succes >= r" :aria-label="`Succès ${r}`" @change="jetMort('succes', r)">
            </span>
            <span>Échecs
              <input v-for="r in 3" :key="`e${r}`" type="checkbox" :checked="fiche.jetsMort.echecs >= r" :aria-label="`Échec ${r}`" @change="jetMort('echecs', r)">
            </span>
          </fieldset>
        </div>
        <label v-for="t in TEXTES_COMBAT" :key="t.cle" class="champ">{{ t.libelle }}
          <textarea :value="fiche[t.cle]" :rows="t.lignes" :maxlength="LONGUEURS[t.cle]" @change="texte(t.cle, $event)" />
        </label>
      </div>

      <div class="colonne">
        <label v-for="t in TEXTES_TRAITS" :key="t.cle" class="champ">{{ t.libelle }}
          <textarea :value="fiche[t.cle]" :rows="t.lignes" :maxlength="LONGUEURS[t.cle]" @change="texte(t.cle, $event)" />
        </label>
      </div>
    </div>

    <div class="recit">
      <label v-for="t in TEXTES_RECIT" :key="t.cle" class="champ">{{ t.libelle }}
        <textarea :value="fiche[t.cle]" :rows="t.lignes" :maxlength="LONGUEURS[t.cle]" @change="texte(t.cle, $event)" />
      </label>
    </div>
  </section>
</template>

<style scoped>
.fiche { padding: 2rem 1.4rem 1.4rem; display: flex; flex-direction: column; gap: 1.2rem; }
.identite { display: flex; flex-direction: column; gap: 0.6rem; }
.nom input { width: 100%; font-family: var(--f-titre); font-size: clamp(1.7rem, 4vw, 2.3rem); border: 0; border-bottom: 2px solid var(--ruban); background: transparent; color: var(--encre); padding: 0.1rem 0; }
.grille-identite { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr)); gap: 0.5rem 0.8rem; }
.statut { margin: 0; min-height: 1.5rem; }
.colonnes { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1.1fr); gap: 1.2rem; align-items: start; }
@media (max-width: 900px) { .colonnes { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .colonnes > :last-child { grid-column: 1 / -1; } }
@media (max-width: 600px) { .colonnes { grid-template-columns: minmax(0, 1fr); } }
.colonne { display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }
.caracs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
.carac { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; padding: 0.4rem 0.2rem; border: 1.5px solid var(--encre-2); border-radius: 6px; background: rgba(246, 236, 212, 0.5); }
.nom-carac { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--encre-2); text-align: center; }
.mod { font-family: var(--f-titre); font-size: 1.6rem; line-height: 1; color: var(--encre); }
.carac input { width: 3.2rem; text-align: center; border: 1px solid var(--papier-ombre); border-radius: 999px; background: #f6ecd4; padding: 0.1rem; color: var(--encre); }
.petit-cadre { margin: 0; display: flex; gap: 0.5rem; align-items: center; padding: 0.3rem 0.6rem; border: 1px solid var(--papier-ombre); border-radius: 4px; font-size: var(--t-s); }
.petit-cadre strong { font-family: var(--f-titre); font-size: 1.3rem; min-width: 2rem; text-align: center; }
.liste { margin: 0; padding: 0.4rem 0.6rem 0.6rem; border: 1px solid var(--papier-ombre); border-radius: 4px; display: flex; flex-direction: column; gap: 0.15rem; font-size: var(--t-s); }
.liste legend { font-family: var(--f-titre); font-size: 1.05rem; padding: 0 0.3rem; }
.ligne { display: flex; align-items: center; gap: 0.4rem; }
.ligne select { font-size: var(--t-xs); border: 1px solid var(--papier-ombre); border-radius: 3px; background: #f6ecd4; color: var(--encre); padding: 0 0.15rem; width: 5.6rem; }
.ligne small { color: var(--encre-2); }
.bonus { font-family: var(--f-cote); min-width: 2.2rem; text-align: right; }
.trio { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
.cadre { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.4rem; border: 1.5px solid var(--encre-2); border-radius: 6px; font-size: var(--t-xs); text-align: center; }
.cadre strong { font-family: var(--f-titre); font-size: 1.5rem; line-height: 1.2; }
.cadre input { width: 100%; text-align: center; font-family: var(--f-titre); font-size: 1.3rem; border: 0; border-bottom: 1px solid var(--papier-ombre); background: transparent; color: var(--encre); }
.pv { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
.duo { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 0.5rem; align-items: start; }
.mort { margin: 0; padding: 0.3rem 0.5rem; border: 1px solid var(--papier-ombre); border-radius: 4px; font-size: var(--t-xs); display: flex; flex-direction: column; gap: 0.15rem; }
.mort legend { padding: 0 0.2rem; }
.recit { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 0.8rem; }
.champ input, .champ textarea { width: 100%; }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
