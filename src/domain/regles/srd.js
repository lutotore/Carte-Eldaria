/**
 * Règles de base tirées du SRD 5.1 (Wizards of the Coast, licence CC BY 4.0) :
 * les 12 classes, une sous-classe chacune, le don Lutteur et les listes d'options.
 * Seuls les noms et la mécanique utile au calcul sont ici ; le texte des règles reste dans les livres.
 * Le contenu des autres livres n'entre jamais dans ce dépôt public : il est chargé par le serveur (mj/).
 *
 * Format « éléments » : chaque entrée a un `type` (classe, sous-classe, don, liste), un `id` et une `source`.
 * Les niveaux des tables `aptitudes` et `choix` sont des niveaux de classe.
 * `multiclasse` : caractéristiques requises (une des alternatives suffit), maîtrises et choix à l'entrée dans la classe.
 */

const SRD = 'SRD 5.1'

const ASI = [4, 8, 12, 16, 19]

/** Une valeur par niveau de classe, du niveau 1 au niveau 20, écrite par paliers : { 1: 2, 4: 3, 10: 4 }. */
function paliers(seuils) {
  let valeur = 0
  return Array.from({ length: 20 }, (_, i) => {
    valeur = seuils[i + 1] ?? valeur
    return valeur
  })
}

/**
 * Sorts d'une classe : `mode` connus, prepares ou grimoire ; `tours` et `connus` par niveau (index 0 = niveau 1) ;
 * `prepares` : « niveau » (mod. + niveau) ou « demi » (mod. + moitié du niveau) ; `secrets` : sorts pris dans n'importe quelle liste.
 */
const SORTS = {
  barde: {
    mode: 'connus', carac: 'cha', tours: paliers({ 1: 2, 4: 3, 10: 4 }),
    connus: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22], secrets: { 10: 2, 14: 2, 18: 2 },
  },
  clerc: { mode: 'prepares', carac: 'sag', tours: paliers({ 1: 3, 4: 4, 10: 5 }), prepares: 'niveau' },
  druide: { mode: 'prepares', carac: 'sag', tours: paliers({ 1: 2, 4: 3, 10: 4 }), prepares: 'niveau' },
  ensorceleur: {
    mode: 'connus', carac: 'cha', tours: paliers({ 1: 4, 4: 5, 10: 6 }),
    connus: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  },
  magicien: { mode: 'grimoire', carac: 'int', tours: paliers({ 1: 3, 4: 4, 10: 5 }), prepares: 'niveau', grimoire: { depart: 6, parNiveau: 2 } },
  occultiste: {
    mode: 'connus', carac: 'cha', tours: paliers({ 1: 2, 4: 3, 10: 4 }),
    connus: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15], arcanum: { 11: 6, 13: 7, 15: 8, 17: 9 },
  },
  paladin: { mode: 'prepares', carac: 'cha', tours: paliers({}), prepares: 'demi' },
  rodeur: { mode: 'connus', carac: 'sag', tours: paliers({}), connus: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11] },
}

const COMPETENCES_RODEUR = ['athletisme', 'discretion', 'dressage', 'investigation', 'nature', 'perception', 'perspicacite', 'survie']
const COMPETENCES_ROUBLARD = ['acrobaties', 'athletisme', 'discretion', 'escamotage', 'intimidation', 'investigation', 'perception',
  'perspicacite', 'persuasion', 'representation', 'tromperie']

/** Une option de liste : un id, un nom, et des prérequis éventuels (niveau de classe, autre choix déjà fait). */
const o = (id, nom, prerequis) => (prerequis ? { id, nom, prerequis } : { id, nom })

export const ELEMENTS_SRD = [
  // --- Listes d'options ---
  {
    type: 'liste', id: 'styles-guerrier', nom: 'Style de combat', groupe: 'styles-combat', source: SRD,
    options: [o('archerie', 'Archerie'), o('defense', 'Défense'), o('duel', 'Duel'), o('arme-a-deux-mains', 'Combat à deux mains'),
      o('protection', 'Protection'), o('deux-armes', 'Combat à deux armes')],
  },
  {
    type: 'liste', id: 'styles-paladin', nom: 'Style de combat', groupe: 'styles-combat', source: SRD,
    options: [o('defense', 'Défense'), o('duel', 'Duel'), o('arme-a-deux-mains', 'Combat à deux mains'), o('protection', 'Protection')],
  },
  {
    type: 'liste', id: 'styles-rodeur', nom: 'Style de combat', groupe: 'styles-combat', source: SRD,
    options: [o('archerie', 'Archerie'), o('defense', 'Défense'), o('duel', 'Duel'), o('deux-armes', 'Combat à deux armes')],
  },
  {
    type: 'liste', id: 'ennemis-jures', nom: 'Ennemi juré', source: SRD,
    options: [o('aberrations', 'Aberrations'), o('betes', 'Bêtes'), o('celestes', 'Célestes'), o('creatures-artificielles', 'Créatures artificielles'),
      o('dragons', 'Dragons'), o('elementaires', 'Élémentaires'), o('fees', 'Fées'), o('fielons', 'Fiélons'), o('geants', 'Géants'),
      o('monstruosites', 'Monstruosités'), o('vases', 'Vases'), o('plantes', 'Plantes'), o('morts-vivants', 'Morts-vivants'),
      o('humanoides', 'Deux peuples humanoïdes (à préciser sur la fiche)')],
  },
  {
    type: 'liste', id: 'terrains-favoris', nom: 'Terrain de prédilection', source: SRD,
    options: [o('arctique', 'Arctique'), o('cote', 'Côte'), o('desert', 'Désert'), o('foret', 'Forêt'), o('prairie', 'Prairie'),
      o('montagne', 'Montagne'), o('marais', 'Marais'), o('outreterre', 'Outreterre')],
  },
  {
    type: 'liste', id: 'terrains-druide', nom: 'Terre du cercle', source: SRD,
    options: [o('arctique', 'Arctique'), o('cote', 'Côte'), o('desert', 'Désert'), o('foret', 'Forêt'), o('prairie', 'Prairie'),
      o('montagne', 'Montagne'), o('marais', 'Marais'), o('outreterre', 'Outreterre')],
  },
  {
    type: 'liste', id: 'metamagie', nom: 'Métamagie', source: SRD,
    options: [o('prudent', 'Sort prudent'), o('distant', 'Sort distant'), o('renforce', 'Sort renforcé'), o('etendu', 'Sort étendu'),
      o('intensifie', 'Sort intensifié'), o('accelere', 'Sort accéléré'), o('subtil', 'Sort subtil'), o('jumeau', 'Sort jumeau')],
  },
  {
    type: 'liste', id: 'ancetres-draconiques', nom: 'Ancêtre draconique', source: SRD,
    options: [o('noir', 'Noir (acide)'), o('bleu', 'Bleu (foudre)'), o('airain', 'Airain (feu)'), o('bronze', 'Bronze (foudre)'),
      o('cuivre', 'Cuivre (acide)'), o('or', 'Or (feu)'), o('vert', 'Vert (poison)'), o('rouge', 'Rouge (feu)'),
      o('argent', 'Argent (froid)'), o('blanc', 'Blanc (froid)')],
  },
  {
    type: 'liste', id: 'pactes', nom: 'Faveur de pacte', source: SRD,
    options: [o('pacte-chaine', 'Pacte de la chaîne'), o('pacte-lame', 'Pacte de la lame'), o('pacte-tome', 'Pacte du tome')],
  },
  {
    type: 'liste', id: 'invocations', nom: 'Manifestation occulte', source: SRD,
    // Les prérequis de sort (Décharge occulte) ne sont pas vérifiés tant que les sorts ne sont pas gérés.
    options: [
      o('explosion-agonisante', 'Explosion agonisante (Décharge occulte)'), o('armure-ombres', 'Armure d’ombres'),
      o('pas-aerien', 'Pas aérien', { niveau: 9 }), o('langage-betes', 'Langage des bêtes'), o('influence-ensorceleuse', 'Influence ensorceleuse'),
      o('murmures-ensorcelants', 'Murmures ensorcelants', { niveau: 7 }), o('livre-secrets', 'Livre des secrets anciens', { choix: 'pacte-tome' }),
      o('chaines-carceri', 'Chaînes de Carcéri', { niveau: 15, choix: 'pacte-chaine' }), o('vision-diable', 'Vision du diable'),
      o('mot-terrifiant', 'Mot terrifiant', { niveau: 7 }), o('vue-occulte', 'Vue occulte'), o('lance-occulte', 'Lance occulte (Décharge occulte)'),
      o('yeux-gardien-runes', 'Yeux du gardien des runes'), o('vigueur-fielone', 'Vigueur fiélone'), o('regard-deux-esprits', 'Regard des deux esprits'),
      o('buveur-vie', 'Buveur de vie', { niveau: 12, choix: 'pacte-lame' }), o('masque-mille-visages', 'Masque aux mille visages'),
      o('maitre-formes', 'Maître des formes multiples', { niveau: 15 }), o('serviteurs-chaos', 'Serviteurs du chaos', { niveau: 9 }),
      o('brume-mentale', 'Brume mentale', { niveau: 5 }), o('visions-brumeuses', 'Visions brumeuses'),
      o('uni-ombres', 'Uni avec les ombres', { niveau: 5 }), o('saut-outre-monde', 'Saut d’outre-monde', { niveau: 9 }),
      o('explosion-repoussante', 'Explosion repoussante (Décharge occulte)'), o('sculpteur-chair', 'Sculpteur de chair', { niveau: 7 }),
      o('mauvais-augure', 'Signe de mauvais augure', { niveau: 5 }), o('voleur-destins', 'Voleur des cinq destins'),
      o('lame-assoiffee', 'Lame assoiffée', { niveau: 5, choix: 'pacte-lame' }), o('royaumes-lointains', 'Visions des royaumes lointains', { niveau: 15 }),
      o('voix-maitre-chaine', 'Voix du maître de la chaîne', { choix: 'pacte-chaine' }), o('murmures-tombe', 'Murmures de la tombe', { niveau: 9 }),
      o('vue-sorciere', 'Vue de sorcière', { niveau: 15 }),
    ],
  },
  {
    type: 'liste', id: 'proie-chasseur', nom: 'Proie du chasseur', source: SRD,
    options: [o('tueur-colosses', 'Tueur de colosses'), o('tueur-geants', 'Tueur de géants'), o('briseur-hordes', 'Briseur de hordes')],
  },
  {
    type: 'liste', id: 'tactiques-defensives', nom: 'Tactiques défensives', source: SRD,
    options: [o('echapper-horde', 'Échapper à la horde'), o('defense-attaques-multiples', 'Défense contre les attaques multiples'), o('volonte-acier', 'Volonté d’acier')],
  },
  {
    type: 'liste', id: 'attaque-multiple', nom: 'Attaque multiple', source: SRD,
    options: [o('volee', 'Volée'), o('attaque-tourbillonnante', 'Attaque tourbillonnante')],
  },
  {
    type: 'liste', id: 'defense-superieure', nom: 'Défense supérieure du chasseur', source: SRD,
    options: [o('esquive-totale', 'Esquive totale'), o('resister-maree', 'Résister à la marée'), o('esquive-instinctive', 'Esquive instinctive')],
  },

  // --- Dons ---
  {
    type: 'don', id: 'lutteur', nom: 'Lutteur', source: SRD, prerequis: { caracs: { for: 13 } },
    resume: 'Avantage contre la créature que tu agrippes, et tu peux tenter de l’immobiliser.',
  },

  // --- Classes ---
  {
    type: 'classe', id: 'barbare', nom: 'Barbare', source: SRD, de: 12, sauvegardes: ['for', 'con'], incantation: null,
    multiclasse: { prerequis: [{ for: 13 }], maitrises: 'boucliers, armes courantes, armes de guerre' },
    niveauSousClasse: 3, ameliorations: ASI,
    aptitudes: {
      1: ['Rage', 'Défense sans armure'], 2: ['Attaque téméraire', 'Sens du danger'], 3: ['Voie primitive'],
      5: ['Attaque supplémentaire', 'Déplacement rapide'], 7: ['Instinct sauvage'], 9: ['Critique brutal (1 dé)'], 11: ['Rage implacable'],
      13: ['Critique brutal (2 dés)'], 15: ['Rage persistante'], 17: ['Critique brutal (3 dés)'], 18: ['Puissance indomptable'], 20: ['Champion primitif'],
    },
  },
  {
    type: 'sous-classe', id: 'berserker', classe: 'barbare', nom: 'Voie du berserker', source: SRD,
    aptitudes: { 3: ['Frénésie'], 6: ['Rage aveugle'], 10: ['Présence intimidante'], 14: ['Représailles'] },
  },
  {
    type: 'classe', id: 'barde', nom: 'Barde', source: SRD, de: 8, sauvegardes: ['dex', 'cha'], incantation: 'complet',
    multiclasse: { prerequis: [{ cha: 13 }], maitrises: 'armures légères, un instrument de musique', choix: [{ type: 'competences', nombre: 1 }] },
    sorts: SORTS.barde,
    niveauSousClasse: 3, ameliorations: ASI,
    aptitudes: {
      1: ['Incantation', 'Inspiration bardique (d6)'], 2: ['Touche-à-tout', 'Chant reposant (d6)'], 3: ['Collège bardique', 'Expertise'],
      5: ['Inspiration bardique (d8)', 'Source d’inspiration'], 6: ['Contre-charme'], 9: ['Chant reposant (d8)'],
      10: ['Inspiration bardique (d10)', 'Expertise', 'Secrets magiques'], 13: ['Chant reposant (d10)'], 14: ['Secrets magiques'],
      15: ['Inspiration bardique (d12)'], 17: ['Chant reposant (d12)'], 18: ['Secrets magiques'], 20: ['Inspiration supérieure'],
    },
    choix: { 3: [{ type: 'expertise', nombre: 2 }], 10: [{ type: 'expertise', nombre: 2 }] },
  },
  {
    type: 'sous-classe', id: 'savoir', classe: 'barde', nom: 'Collège du savoir', source: SRD,
    sorts: { secrets: { 6: 2 } }, // Secrets magiques supplémentaires : deux sorts de plus, pris dans n'importe quelle liste.
    aptitudes: { 3: ['Compétences supplémentaires', 'Mots cinglants'], 6: ['Secrets magiques supplémentaires'], 14: ['Compétence hors pair'] },
    choix: { 3: [{ type: 'competences', nombre: 3 }] },
  },
  {
    type: 'classe', id: 'clerc', nom: 'Clerc', source: SRD, de: 8, sauvegardes: ['sag', 'cha'], incantation: 'complet',
    multiclasse: { prerequis: [{ sag: 13 }], maitrises: 'armures légères et intermédiaires, boucliers' },
    sorts: SORTS.clerc,
    niveauSousClasse: 1, ameliorations: ASI,
    aptitudes: {
      1: ['Incantation', 'Domaine divin'], 2: ['Conduit divin (1 par repos)', 'Renvoi des morts-vivants'],
      5: ['Destruction des morts-vivants (FP 1/2)'], 6: ['Conduit divin (2 par repos)'], 8: ['Destruction des morts-vivants (FP 1)'],
      10: ['Intervention divine'], 11: ['Destruction des morts-vivants (FP 2)'], 14: ['Destruction des morts-vivants (FP 3)'],
      17: ['Destruction des morts-vivants (FP 4)'], 18: ['Conduit divin (3 par repos)'], 20: ['Intervention divine améliorée'],
    },
  },
  {
    type: 'sous-classe', id: 'vie', classe: 'clerc', nom: 'Domaine de la vie', source: SRD,
    aptitudes: {
      1: ['Maîtrise des armures lourdes', 'Disciple de la vie'], 2: ['Conduit divin : préservation de la vie'],
      6: ['Guérisseur béni'], 8: ['Frappe divine'], 17: ['Guérison suprême'],
    },
  },
  {
    type: 'classe', id: 'druide', nom: 'Druide', source: SRD, de: 8, sauvegardes: ['int', 'sag'], incantation: 'complet',
    multiclasse: { prerequis: [{ sag: 13 }], maitrises: 'armures légères et intermédiaires, boucliers (sans métal)' },
    sorts: SORTS.druide,
    niveauSousClasse: 2, ameliorations: ASI,
    aptitudes: {
      1: ['Druidique', 'Incantation'], 2: ['Forme sauvage', 'Cercle druidique'], 4: ['Forme sauvage améliorée (FP 1/2, sans vol)'],
      8: ['Forme sauvage améliorée (FP 1)'], 18: ['Jeunesse éternelle', 'Incantation bestiale'], 20: ['Archidruide'],
    },
  },
  {
    type: 'sous-classe', id: 'terre', classe: 'druide', nom: 'Cercle de la terre', source: SRD,
    aptitudes: {
      2: ['Tour de magie supplémentaire', 'Récupération naturelle'], 3: ['Sorts de cercle'], 6: ['Traversée des terrains'],
      10: ['Protection naturelle'], 14: ['Sanctuaire naturel'],
    },
    choix: { 3: [{ liste: 'terrains-druide', nombre: 1 }] },
  },
  {
    type: 'classe', id: 'ensorceleur', nom: 'Ensorceleur', source: SRD, de: 6, sauvegardes: ['con', 'cha'], incantation: 'complet',
    multiclasse: { prerequis: [{ cha: 13 }], maitrises: '' },
    sorts: SORTS.ensorceleur,
    niveauSousClasse: 1, ameliorations: ASI,
    aptitudes: {
      1: ['Incantation', 'Origine magique'], 2: ['Source de magie'], 3: ['Métamagie'], 10: ['Métamagie'], 17: ['Métamagie'],
      20: ['Restauration ensorcelée'],
    },
    choix: { 3: [{ liste: 'metamagie', nombre: 2 }], 10: [{ liste: 'metamagie', nombre: 1 }], 17: [{ liste: 'metamagie', nombre: 1 }] },
  },
  {
    // Résistance draconique : +1 PV par niveau d'ensorceleur.
    type: 'sous-classe', id: 'draconique', classe: 'ensorceleur', nom: 'Lignée draconique', source: SRD, pvParNiveau: 1,
    aptitudes: { 1: ['Ancêtre draconique', 'Résistance draconique'], 6: ['Affinité élémentaire'], 14: ['Ailes de dragon'], 18: ['Présence draconique'] },
    choix: { 1: [{ liste: 'ancetres-draconiques', nombre: 1 }] },
  },
  {
    type: 'classe', id: 'guerrier', nom: 'Guerrier', source: SRD, de: 10, sauvegardes: ['for', 'con'], incantation: null,
    multiclasse: { prerequis: [{ for: 13 }, { dex: 13 }], maitrises: 'armures légères et intermédiaires, boucliers, armes courantes, armes de guerre' },
    niveauSousClasse: 3, ameliorations: [4, 6, 8, 12, 14, 16, 19],
    aptitudes: {
      1: ['Style de combat', 'Second souffle'], 2: ['Fougue (1 utilisation)'], 3: ['Archétype martial'], 5: ['Attaque supplémentaire'],
      9: ['Indomptable (1 utilisation)'], 11: ['Attaque supplémentaire (2)'], 13: ['Indomptable (2 utilisations)'],
      17: ['Fougue (2 utilisations)', 'Indomptable (3 utilisations)'], 20: ['Attaque supplémentaire (3)'],
    },
    choix: { 1: [{ liste: 'styles-guerrier', nombre: 1 }] },
  },
  {
    type: 'sous-classe', id: 'champion', classe: 'guerrier', nom: 'Champion', source: SRD,
    aptitudes: { 3: ['Critique amélioré'], 7: ['Athlète remarquable'], 10: ['Style de combat supplémentaire'], 15: ['Critique supérieur'], 18: ['Survivant'] },
    choix: { 10: [{ liste: 'styles-guerrier', nombre: 1 }] },
  },
  {
    type: 'classe', id: 'magicien', nom: 'Magicien', source: SRD, de: 6, sauvegardes: ['int', 'sag'], incantation: 'complet',
    multiclasse: { prerequis: [{ int: 13 }], maitrises: '' },
    sorts: SORTS.magicien,
    niveauSousClasse: 2, ameliorations: ASI,
    aptitudes: { 1: ['Incantation', 'Restauration arcanique'], 2: ['Tradition arcanique'], 18: ['Maîtrise des sorts'], 20: ['Sorts de prédilection'] },
  },
  {
    type: 'sous-classe', id: 'evocation', classe: 'magicien', nom: 'École d’évocation', source: SRD,
    aptitudes: { 2: ['Évocateur érudit', 'Sculpteur de sorts'], 6: ['Tour de magie puissant'], 10: ['Évocation renforcée'], 14: ['Surcharge'] },
  },
  {
    type: 'classe', id: 'moine', nom: 'Moine', source: SRD, de: 8, sauvegardes: ['for', 'dex'], incantation: null,
    multiclasse: { prerequis: [{ dex: 13, sag: 13 }], maitrises: 'armes courantes, épées courtes' },
    niveauSousClasse: 3, ameliorations: ASI,
    aptitudes: {
      1: ['Défense sans armure', 'Arts martiaux'], 2: ['Ki', 'Déplacement sans armure'], 3: ['Tradition monastique', 'Parade de projectiles'],
      4: ['Chute ralentie'], 5: ['Attaque supplémentaire', 'Frappe étourdissante'], 6: ['Frappes de ki', 'Déplacement sans armure amélioré'],
      7: ['Dérobade', 'Tranquillité d’esprit'], 10: ['Pureté physique'], 13: ['Langue du soleil et de la lune'], 14: ['Âme de diamant'],
      15: ['Jeunesse éternelle'], 18: ['Corps vide'], 20: ['Perfection de soi'],
    },
  },
  {
    type: 'sous-classe', id: 'main-ouverte', classe: 'moine', nom: 'Voie de la main ouverte', source: SRD,
    aptitudes: { 3: ['Technique de la main ouverte'], 6: ['Plénitude physique'], 11: ['Tranquillité'], 17: ['Paume vibratoire'] },
  },
  {
    type: 'classe', id: 'occultiste', nom: 'Occultiste', source: SRD, de: 8, sauvegardes: ['sag', 'cha'], incantation: 'pacte',
    multiclasse: { prerequis: [{ cha: 13 }], maitrises: 'armures légères, armes courantes' },
    sorts: SORTS.occultiste,
    niveauSousClasse: 1, ameliorations: ASI,
    aptitudes: {
      1: ['Patron d’outre-monde', 'Magie de pacte'], 2: ['Manifestations occultes (2)'], 3: ['Faveur de pacte'],
      5: ['Manifestations occultes (3)'], 7: ['Manifestations occultes (4)'], 9: ['Manifestations occultes (5)'],
      11: ['Arcanum mystique (niveau 6)'], 12: ['Manifestations occultes (6)'], 13: ['Arcanum mystique (niveau 7)'],
      15: ['Arcanum mystique (niveau 8)', 'Manifestations occultes (7)'], 17: ['Arcanum mystique (niveau 9)'],
      18: ['Manifestations occultes (8)'], 20: ['Maître de l’occulte'],
    },
    choix: {
      2: [{ liste: 'invocations', nombre: 2 }], 3: [{ liste: 'pactes', nombre: 1 }], 5: [{ liste: 'invocations', nombre: 1 }],
      7: [{ liste: 'invocations', nombre: 1 }], 9: [{ liste: 'invocations', nombre: 1 }], 12: [{ liste: 'invocations', nombre: 1 }],
      15: [{ liste: 'invocations', nombre: 1 }], 18: [{ liste: 'invocations', nombre: 1 }],
    },
  },
  {
    type: 'sous-classe', id: 'fielon', classe: 'occultiste', nom: 'Le Fiélon', source: SRD,
    aptitudes: { 1: ['Bénédiction du ténébreux'], 6: ['Chance du ténébreux'], 10: ['Résistance fiélone'], 14: ['Traversée de l’enfer'] },
  },
  {
    type: 'classe', id: 'paladin', nom: 'Paladin', source: SRD, de: 10, sauvegardes: ['sag', 'cha'], incantation: 'demi',
    multiclasse: { prerequis: [{ for: 13, cha: 13 }], maitrises: 'armures légères et intermédiaires, boucliers, armes courantes, armes de guerre' },
    sorts: SORTS.paladin,
    niveauSousClasse: 3, ameliorations: ASI,
    aptitudes: {
      1: ['Sens divin', 'Imposition des mains'], 2: ['Style de combat', 'Incantation', 'Châtiment divin'], 3: ['Santé divine', 'Serment sacré'],
      5: ['Attaque supplémentaire'], 6: ['Aura de protection'], 10: ['Aura de courage'], 11: ['Châtiment divin amélioré'],
      14: ['Contact purifiant'], 18: ['Améliorations d’aura'],
    },
    choix: { 2: [{ liste: 'styles-paladin', nombre: 1 }] },
  },
  {
    type: 'sous-classe', id: 'devotion', classe: 'paladin', nom: 'Serment de dévotion', source: SRD,
    aptitudes: { 3: ['Conduit divin : arme sacrée, renvoi des impies'], 7: ['Aura de dévotion'], 15: ['Pureté d’esprit'], 20: ['Halo sacré'] },
  },
  {
    type: 'classe', id: 'rodeur', nom: 'Rôdeur', source: SRD, de: 10, sauvegardes: ['for', 'dex'], incantation: 'demi',
    multiclasse: {
      prerequis: [{ dex: 13, sag: 13 }], maitrises: 'armures légères et intermédiaires, boucliers, armes courantes, armes de guerre',
      choix: [{ type: 'competences', nombre: 1, parmi: COMPETENCES_RODEUR }],
    },
    sorts: SORTS.rodeur,
    niveauSousClasse: 3, ameliorations: ASI,
    aptitudes: {
      1: ['Ennemi juré', 'Explorateur-né'], 2: ['Style de combat', 'Incantation'], 3: ['Archétype de rôdeur', 'Vigilance primitive'],
      5: ['Attaque supplémentaire'], 6: ['Ennemi juré amélioré', 'Explorateur-né amélioré'], 8: ['Traversée des terrains'],
      10: ['Explorateur-né amélioré', 'Camouflage naturel'], 14: ['Ennemi juré amélioré', 'Disparition'], 18: ['Sens sauvages'],
      20: ['Tueur d’ennemis'],
    },
    choix: {
      1: [{ liste: 'ennemis-jures', nombre: 1 }, { liste: 'terrains-favoris', nombre: 1 }], 2: [{ liste: 'styles-rodeur', nombre: 1 }],
      6: [{ liste: 'ennemis-jures', nombre: 1 }, { liste: 'terrains-favoris', nombre: 1 }], 10: [{ liste: 'terrains-favoris', nombre: 1 }],
      14: [{ liste: 'ennemis-jures', nombre: 1 }],
    },
  },
  {
    type: 'sous-classe', id: 'chasseur', classe: 'rodeur', nom: 'Chasseur', source: SRD,
    aptitudes: { 3: ['Proie du chasseur'], 7: ['Tactiques défensives'], 11: ['Attaque multiple'], 15: ['Défense supérieure du chasseur'] },
    choix: {
      3: [{ liste: 'proie-chasseur', nombre: 1 }], 7: [{ liste: 'tactiques-defensives', nombre: 1 }],
      11: [{ liste: 'attaque-multiple', nombre: 1 }], 15: [{ liste: 'defense-superieure', nombre: 1 }],
    },
  },
  {
    type: 'classe', id: 'roublard', nom: 'Roublard', source: SRD, de: 8, sauvegardes: ['dex', 'int'], incantation: null,
    multiclasse: {
      prerequis: [{ dex: 13 }], maitrises: 'armures légères, outils de voleur',
      choix: [{ type: 'competences', nombre: 1, parmi: COMPETENCES_ROUBLARD }],
    },
    niveauSousClasse: 3, ameliorations: [4, 8, 10, 12, 16, 19],
    aptitudes: {
      1: ['Expertise', 'Attaque sournoise (1d6)', 'Jargon des voleurs'], 2: ['Ruse'], 3: ['Archétype de roublard', 'Attaque sournoise (2d6)'],
      5: ['Esquive instinctive', 'Attaque sournoise (3d6)'], 6: ['Expertise'], 7: ['Dérobade', 'Attaque sournoise (4d6)'],
      9: ['Attaque sournoise (5d6)'], 11: ['Talent', 'Attaque sournoise (6d6)'], 13: ['Attaque sournoise (7d6)'], 14: ['Perception aveugle'],
      15: ['Esprit fuyant', 'Attaque sournoise (8d6)'], 17: ['Attaque sournoise (9d6)'], 18: ['Insaisissable'],
      19: ['Attaque sournoise (10d6)'], 20: ['Coup de chance'],
    },
    choix: { 1: [{ type: 'expertise', nombre: 2, outils: true }], 6: [{ type: 'expertise', nombre: 2, outils: true }] },
  },
  {
    type: 'sous-classe', id: 'voleur', classe: 'roublard', nom: 'Voleur', source: SRD,
    aptitudes: { 3: ['Mains lestes', 'Monte-en-l’air'], 9: ['Furtivité suprême'], 13: ['Utilisation d’objets magiques'], 17: ['Réflexes de voleur'] },
  },
]
