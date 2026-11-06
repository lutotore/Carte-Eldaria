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
  /** « feuille » : la page 1 de la feuille officielle ; « recit » : apparence, histoire, notes. */
  partie: { type: String, default: 'feuille' },
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
/** Sur une fiche qui suit les règles, la montée de niveau tient à jour la classe, le niveau et les dés de vie. */
const suitLesRegles = computed(() => Boolean(fiche.value.regles))
const VERROU = 'Tenu à jour par la montée de niveau.'
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


const IDENTITE = [
  { cle: 'espece', libelle: 'Espèce' },
  { cle: 'historique', libelle: 'Historique' },
  { cle: 'alignement', libelle: 'Alignement' },
]
const abrege = (cle) => CARACTERISTIQUES.find((k) => k.cle === cle).nom.slice(0, 3)
const textesCombat = computed(() => [
  { cle: 'attaques', libelle: 'Attaques et incantations', lignes: 5 },
  // Sur une fiche qui suit les règles, les sorts se gèrent dans la page Sorts : ce champ ne sert plus qu'aux notes.
  { cle: 'sorts', libelle: suitLesRegles.value ? 'Notes sur les sorts' : 'Sorts', lignes: suitLesRegles.value ? 3 : 6 },
])
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
  <section v-if="partie === 'feuille'" class="fiche papier epingle" aria-labelledby="nom-personnage">
    <header class="identite">
      <label class="nom">
        <span class="visuellement-cache">Nom du personnage</span>
        <input id="nom-personnage" :value="fiche.nom" maxlength="80" required @change="texte('nom', $event)">
        <span class="sous-titre">Nom du personnage</span>
      </label>
      <div class="details">
        <label class="detail large">
          <input :value="fiche.classe" maxlength="120" :readonly="suitLesRegles" :title="suitLesRegles ? VERROU : null" @change="texte('classe', $event)">
          <span>Classe</span>
        </label>
        <label class="detail court">
          <input type="number" min="1" max="20" :value="fiche.niveau" :readonly="suitLesRegles" :title="suitLesRegles ? VERROU : null" @change="nombre('niveau', $event)">
          <span>Niveau</span>
        </label>
        <label v-for="champ in IDENTITE" :key="champ.cle" class="detail">
          <input :value="fiche[champ.cle]" maxlength="120" @change="texte(champ.cle, $event)">
          <span>{{ champ.libelle }}</span>
        </label>
        <label class="detail">
          <input type="number" min="0" :value="fiche.xp" @change="nombre('xp', $event)">
          <span>Points d’expérience</span>
        </label>
      </div>
      <p class="statut" aria-live="polite">
        <span v-if="erreur" class="message message--erreur">{{ erreur }}</span>
        <span v-else-if="enregistre && !enCours" class="message message--ok">{{ enregistre }}</span>
      </p>
    </header>

    <div class="corps">
      <div class="bande-caracs">
        <label v-for="k in CARACTERISTIQUES" :key="k.cle" class="carac">
          <span class="nom-carac">{{ k.nom }}</span>
          <strong class="mod">{{ signe(c.modificateurs[k.cle]) }}</strong>
          <input type="number" min="1" max="30" :value="fiche.caracteristiques[k.cle]" :aria-label="`${k.nom} (valeur)`" @change="caracteristique(k.cle, $event)">
        </label>
      </div>

      <div class="colonne">
        <p class="petit-cadre"><strong>{{ signe(c.maitrise) }}</strong> Bonus de maîtrise</p>
        <fieldset class="encadre">
          <legend>Jets de sauvegarde</legend>
          <label v-for="k in CARACTERISTIQUES" :key="k.cle" class="ligne">
            <input type="checkbox" :checked="fiche.sauvegardes.includes(k.cle)" @change="basculerSauvegarde(k.cle)">
            <span class="bonus">{{ signe(c.sauvegardes[k.cle]) }}</span> {{ k.nom }}
          </label>
        </fieldset>
        <fieldset class="encadre">
          <legend>Compétences</legend>
          <div v-for="comp in COMPETENCES" :key="comp.cle" class="ligne">
            <select :value="fiche.competences[comp.cle] ?? 0" :class="`maitrise-${fiche.competences[comp.cle] ?? 0}`"
              :aria-label="`Maîtrise : ${comp.nom}`" :title="MAITRISES.find((m) => m.valeur === (fiche.competences[comp.cle] ?? 0)).nom"
              @change="maitriseCompetence(comp.cle, $event)">
              <option v-for="m in MAITRISES" :key="m.valeur" :value="m.valeur">{{ ['○', '●', '◆'][m.valeur] }} {{ m.nom }}</option>
            </select>
            <span class="bonus">{{ signe(c.competences[comp.cle]) }}</span>
            <span class="nom-comp">{{ comp.nom }} <small>({{ abrege(comp.carac) }})</small></span>
          </div>
        </fieldset>
        <p class="petit-cadre"><strong>{{ c.perceptionPassive }}</strong> Sagesse (Perception) passive</p>
      </div>

      <div class="colonne">
        <label class="encadre champ-encadre">
          <span class="titre-encadre">Dés de vie</span>
          <input :value="fiche.desDeVie" maxlength="60" placeholder="ex. 3d8" :readonly="suitLesRegles" :title="suitLesRegles ? VERROU : null" @change="texte('desDeVie', $event)">
        </label>
        <label v-for="t in textesCombat" :key="t.cle" class="encadre champ-encadre">
          <span class="titre-encadre">{{ t.libelle }}</span>
          <textarea :value="fiche[t.cle]" :rows="t.lignes" :maxlength="LONGUEURS[t.cle]" @change="texte(t.cle, $event)" />
        </label>
      </div>

      <div class="colonne">
        <label v-for="t in TEXTES_TRAITS" :key="t.cle" class="encadre champ-encadre">
          <span class="titre-encadre">{{ t.libelle }}</span>
          <textarea :value="fiche[t.cle]" :rows="t.lignes" :maxlength="LONGUEURS[t.cle]" @change="texte(t.cle, $event)" />
        </label>
      </div>
    </div>
  </section>

  <section v-else class="fiche papier recit" aria-label="Apparence et histoire">
    <label v-for="t in TEXTES_RECIT" :key="t.cle" class="encadre champ-encadre">
      <span class="titre-encadre">{{ t.libelle }}</span>
      <textarea :value="fiche[t.cle]" :rows="t.lignes" :maxlength="LONGUEURS[t.cle]" @change="texte(t.cle, $event)" />
    </label>
    <p class="statut" aria-live="polite">
      <span v-if="erreur" class="message message--erreur">{{ erreur }}</span>
      <span v-else-if="enregistre && !enCours" class="message message--ok">{{ enregistre }}</span>
    </p>
  </section>
</template>

<style scoped>
.fiche { padding: 1.6rem 1.4rem 1.4rem; display: flex; flex-direction: column; gap: 1rem; }

/* En-tête : le nom à gauche, les détails dans un cadre à droite, comme sur la feuille papier. */
.identite { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.8fr); gap: 0.4rem 1.2rem; align-items: end; }
.nom { display: flex; flex-direction: column; }
.nom input { width: 100%; font-family: var(--f-titre); font-size: clamp(1.6rem, 3.6vw, 2.2rem); border: 0; border-bottom: 2px solid var(--ruban); background: transparent; color: var(--encre); padding: 0.1rem 0; }
.sous-titre, .detail span { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--encre-2); }
.details { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.3rem 0.8rem; padding: 0.5rem 0.7rem; border: 1.5px solid var(--encre-2); border-radius: 6px; background: rgba(246, 236, 212, 0.45); }
.detail { display: flex; flex-direction: column; min-width: 0; }
.detail.large { grid-column: span 2; }
.detail input { border: 0; border-bottom: 1px solid var(--papier-ombre); background: transparent; color: var(--encre); padding: 0.1rem 0; font-size: 1rem; min-width: 0; }
.detail input[readonly] { color: var(--encre-2); }
.statut { grid-column: 1 / -1; margin: 0; min-height: 1.3rem; }
@media (max-width: 760px) {
  .identite { grid-template-columns: minmax(0, 1fr); }
  .details { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Corps : bande des caractéristiques, puis trois colonnes. */
.corps { display: grid; grid-template-columns: 6.6rem minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 1.05fr); gap: 1rem; align-items: start; }
@media (max-width: 1100px) { .corps { grid-template-columns: 6.6rem minmax(0, 1fr) minmax(0, 1fr); } .corps > :last-child { grid-column: 2 / -1; } }
@media (max-width: 760px) {
  .corps { grid-template-columns: minmax(0, 1fr); }
  .corps > :last-child { grid-column: auto; }
}
.bande-caracs { display: flex; flex-direction: column; gap: 0.45rem; padding: 0.45rem; border-radius: 8px; background: rgba(106, 80, 55, 0.12); }
@media (max-width: 760px) {
  .bande-caracs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.carac { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.35rem 0.2rem 0.45rem; border: 1.5px solid var(--encre-2); border-radius: 8px 8px 40% 40% / 8px 8px 22% 22%; background: #f6ecd4; }
.nom-carac { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--encre-2); text-align: center; }
.mod { font-family: var(--f-titre); font-size: 1.7rem; line-height: 1; color: var(--encre); }
.carac input { width: 3rem; text-align: center; border: 1px solid var(--papier-ombre); border-radius: 999px; background: var(--papier); padding: 0.05rem; color: var(--encre); }
.colonne { display: flex; flex-direction: column; gap: 0.7rem; min-width: 0; }
.petit-cadre { margin: 0; display: flex; gap: 0.5rem; align-items: center; padding: 0.3rem 0.6rem; border: 1.5px solid var(--encre-2); border-radius: 999px 6px 6px 999px; font-size: var(--t-s); background: rgba(246, 236, 212, 0.45); }
.petit-cadre strong { font-family: var(--f-titre); font-size: 1.3rem; min-width: 2.2rem; text-align: center; border: 1px solid var(--papier-ombre); border-radius: 50%; background: #f6ecd4; }
.encadre { margin: 0; padding: 0.35rem 0.6rem 0.55rem; border: 1.5px solid var(--encre-2); border-radius: 6px; background: rgba(246, 236, 212, 0.45); display: flex; flex-direction: column; gap: 0.1rem; font-size: var(--t-s); min-width: 0; }
.encadre legend { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--encre-2); padding: 0 0.3rem; }
.ligne { display: flex; align-items: center; gap: 0.35rem; min-height: 1.6rem; }
.ligne select { appearance: none; width: 1.6rem; padding: 0; border: 0; background: transparent; color: var(--encre); font-size: 0.95rem; text-align: center; cursor: pointer; }
.ligne select.maitrise-1 { color: var(--ruban); }
.ligne select.maitrise-2 { color: var(--rouge); }
.nom-comp small { color: var(--encre-2); }
.bonus { font-family: var(--f-cote); min-width: 2.1rem; text-align: right; border-bottom: 1px solid var(--papier-ombre); }
.champ-encadre { color: var(--encre); }
.titre-encadre { order: 2; text-align: center; font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--encre-2); padding-top: 0.15rem; }
.champ-encadre input, .champ-encadre textarea { width: 100%; border: 0; background: transparent; color: var(--encre); font: inherit; font-size: 0.95rem; resize: vertical; padding: 0.2rem 0; }
.champ-encadre textarea { background-image: repeating-linear-gradient(transparent, transparent 1.45rem, var(--ligne-cahier) 1.45rem, var(--ligne-cahier) calc(1.45rem + 1px)); line-height: 1.45rem; }
.recit { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 0.8rem; padding: 1rem 1.2rem; }
.recit .statut { grid-column: 1 / -1; }
.visuellement-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
