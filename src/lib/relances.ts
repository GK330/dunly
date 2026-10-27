import { echapperHtml, paragraphesHtml } from "@/lib/html";

// Logique des relances, sans dépendance au serveur : elle est entièrement testable.

export type NiveauRelance = 1 | 2 | 3;

export type StatutRelance = "brouillon" | "validee" | "envoyee" | "annulee";

export type OrigineContenu = "ia" | "modele" | "utilisateur";

// Nombre de jours de retard à partir duquel chaque niveau de relance part
export const SEUILS_RELANCE: Record<NiveauRelance, number> = { 1: 3, 2: 15, 3: 30 };

export const LIBELLES_NIVEAU: Record<NiveauRelance, string> = {
  1: "Rappel courtois",
  2: "Relance ferme",
  3: "Relance avec rappel des pénalités",
};

export const LIBELLES_STATUT_RELANCE: Record<StatutRelance, { libelle: string; classes: string }> = {
  brouillon: { libelle: "À valider", classes: "bg-yellow-100 text-yellow-800" },
  validee: { libelle: "Validée", classes: "bg-abricot text-mandarine-fonce" },
  envoyee: { libelle: "Envoyée", classes: "bg-green-100 text-green-800" },
  annulee: { libelle: "Annulée", classes: "bg-stone-100 text-stone-600" },
};

export const PHRASE_DEJA_REGLE = "Si vous avez déjà réglé cette facture, merci d’ignorer ce message.";

export const MENTION_PENALITES =
  "Nous vous rappelons que, conformément à l’article L441-10 du Code de commerce, tout retard de paiement entraîne de plein droit des pénalités de retard ainsi qu’une indemnité forfaitaire pour frais de recouvrement de 40 €.";

// Niveau de relance dû pour un nombre de jours de retard donné (0 : aucune relance)
export function niveauDu(joursDeRetard: number): NiveauRelance | 0 {
  if (joursDeRetard >= SEUILS_RELANCE[3]) return 3;
  if (joursDeRetard >= SEUILS_RELANCE[2]) return 2;
  if (joursDeRetard >= SEUILS_RELANCE[1]) return 1;
  return 0;
}

// Délai minimal entre deux relances envoyées pour une même facture
export const DELAI_MIN_ENTRE_RELANCES = 7;

// Niveau de la prochaine relance à préparer (0 : rien à préparer).
// La première relance est toujours polie : on monte d'un niveau à chaque envoi,
// sans dépasser le niveau dû au retard, et jamais deux relances à moins de 7 jours.
export function niveauAPreparer(
  joursDeRetard: number,
  dernierNiveauEnvoye: number,
  joursDepuisDernierEnvoi: number | null
): NiveauRelance | 0 {
  const du = niveauDu(joursDeRetard);
  const cible = Math.min(du, dernierNiveauEnvoye + 1);

  if (cible <= dernierNiveauEnvoye) return 0;
  if (joursDepuisDernierEnvoi !== null && joursDepuisDernierEnvoi < DELAI_MIN_ENTRE_RELANCES) {
    return 0;
  }

  return cible as NiveauRelance;
}

// Historique du client, calculé en SQL (vue statistiques_clients)
export type StatistiquesClient = {
  nombre_factures: number;
  nombre_retards: number;
  retard_moyen_jours: number;
};

export type Risque = { niveau: "faible" | "moyen" | "eleve"; libelle: string; classes: string };

export function scoreDeRisque(stats: StatistiquesClient): Risque {
  if (stats.nombre_retards >= 3 || stats.retard_moyen_jours >= 30) {
    return { niveau: "eleve", libelle: "Risque élevé", classes: "bg-red-100 text-red-800" };
  }
  if (stats.nombre_retards >= 1) {
    return { niveau: "moyen", libelle: "Risque moyen", classes: "bg-yellow-100 text-yellow-800" };
  }
  return { niveau: "faible", libelle: "Risque faible", classes: "bg-green-100 text-green-800" };
}

// Ton conseillé à l'IA selon le niveau et l'historique. Le retard en cours fait
// partie des retards comptés : un client fidèle à son premier retard en a un seul.
export function choisirTon(niveau: NiveauRelance, stats: StatistiquesClient): string {
  const retardsPrecedents = Math.max(0, stats.nombre_retards - 1);
  const clientFidele = stats.nombre_factures >= 3 && retardsPrecedents === 0;

  if (niveau === 3) {
    return "formel et très ferme, sans agressivité";
  }

  if (retardsPrecedents >= 2 || stats.retard_moyen_jours >= 20) {
    return niveau === 1 ? "poli mais ferme" : "ferme et direct";
  }

  if (niveau === 2) {
    return "ferme mais courtois";
  }

  return clientFidele ? "chaleureux et compréhensif" : "courtois et bienveillant";
}

// Anti-hallucination : l'IA n'écrit que le corps du message. Les valeurs
// (montant, numéro, dates) sont des balises remplacées par le code.
export const BALISES = ["client", "numero", "montant", "emise_le", "echeance"] as const;
export type Balise = (typeof BALISES)[number];

export const CORPS_MIN = 40;
export const CORPS_MAX = 1500;

const MOIS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet",
  "aout", "septembre", "octobre", "novembre", "decembre",
];

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

// Dates relatives : elles engageraient l'indépendant sur un délai qu'il n'a pas choisi
const DATES_RELATIVES = ["demain", "hier", "huitaine", "quinzaine", "semaine prochaine", "fin du mois"];

// Nombres écrits en lettres : un moyen détourné d'écrire un montant ou un délai
const NOMBRES = [
  "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze",
  "treize", "quatorze", "quinze", "seize", "vingt", "trente", "quarante", "cinquante",
  "soixante", "cent", "cents", "mille", "million", "millions",
];

const MONNAIES = ["euro", "euros", "eur", "€", "$", "dollar", "dollars"];

function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function contientMot(texte: string, mot: string): boolean {
  const echappe = mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${echappe}([^a-z]|$)`).test(texte);
}

export type Verification = { valide: boolean; raisons: string[] };

export function verifierCorps(corps: string): Verification {
  const raisons: string[] = [];
  const texte = corps.trim();

  if (texte.length < CORPS_MIN || texte.length > CORPS_MAX) {
    raisons.push(`longueur hors limites (${texte.length} caractères)`);
  }

  // Les balises autorisées sont retirées avant les vérifications suivantes
  const balisesTrouvees = [...texte.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)].map((m) => m[1]);
  const inconnues = balisesTrouvees.filter((b) => !(BALISES as readonly string[]).includes(b));
  if (inconnues.length > 0) {
    raisons.push(`balise inconnue : ${inconnues.join(", ")}`);
  }

  const sansBalises = sansAccents(texte.replace(/\{\{\s*[a-z_]+\s*\}\}/g, " "));

  if (/[{}]/.test(sansBalises)) raisons.push("accolade hors balise");
  if (/\d/.test(sansBalises)) raisons.push("contient un chiffre");
  if (/https?:|www\.|@/.test(sansBalises)) raisons.push("contient un lien ou une adresse");

  for (const [liste, raison] of [
    [MONNAIES, "contient une monnaie"],
    [MOIS, "contient un mois"],
    [JOURS, "contient un jour de la semaine"],
    [DATES_RELATIVES, "contient une date relative"],
    [NOMBRES, "contient un nombre en lettres"],
  ] as const) {
    const trouve = liste.find((mot) => mot === "€" || mot === "$"
      ? sansBalises.includes(mot)
      : contientMot(sansBalises, mot));
    if (trouve) raisons.push(`${raison} (« ${trouve} »)`);
  }

  return { valide: raisons.length === 0, raisons };
}

// Texte modifié par l'utilisateur : il reste libre de ses mots, mais les
// valeurs de la facture doivent passer par les balises pour rester exactes
export const CONTENU_UTILISATEUR_MAX = 3000;

export const LIBELLES_BALISES: Record<Balise, string> = {
  client: "Client",
  numero: "N° de facture",
  montant: "Montant TTC",
  emise_le: "Émise le",
  echeance: "Échéance",
};

export type VerificationSaisie = { erreurs: string[]; avertissements: string[] };

export function verifierSaisie(corps: string): VerificationSaisie {
  const texte = corps.trim();
  const erreurs: string[] = [];
  const avertissements: string[] = [];

  if (texte.length < 10 || texte.length > CONTENU_UTILISATEUR_MAX) {
    erreurs.push(`Le texte doit contenir entre 10 et ${CONTENU_UTILISATEUR_MAX} caractères.`);
  }

  const inconnues = [...texte.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)]
    .map((m) => m[1])
    .filter((b) => !(BALISES as readonly string[]).includes(b));
  if (inconnues.length > 0) {
    erreurs.push(`Balise inconnue : {{${inconnues[0]}}}.`);
  }

  // Une accolade seule est le reste d'une balise abîmée : elle partirait telle quelle
  const sansBalises = texte.replace(/\{\{\s*[^{}]*?\s*\}\}/g, " ");
  if (/[{}]/.test(sansBalises)) {
    erreurs.push("Une balise est incomplète (accolade isolée) : supprimez-la et insérez-la de nouveau.");
  }

  if (/\d/.test(sansBalises) || /€|\beuros?\b/i.test(sansBalises)) {
    avertissements.push(
      "Un montant, un numéro ou une date tapés à la main ne sont pas vérifiés : préférez les pastilles, toujours exactes."
    );
  }

  return { erreurs, avertissements };
}

// Modèles de texte fixes, utilisés quand l'IA est indisponible, hors quota,
// ou quand son texte ne passe pas la vérification
export const MODELES_RELANCE: Record<NiveauRelance, string> = {
  1: `Sauf erreur de notre part, la facture {{numero}} d’un montant de {{montant}}, arrivée à échéance le {{echeance}}, n’a pas encore été réglée.

Il s’agit sans doute d’un simple oubli. Pourriez-vous procéder à son règlement dès que possible ? Je reste à votre disposition pour toute question.`,
  2: `Malgré notre précédent rappel, la facture {{numero}} d’un montant de {{montant}}, échue le {{echeance}}, demeure impayée.

Je vous remercie de bien vouloir procéder à son règlement dans les meilleurs délais. Si une difficulté empêche ce paiement, merci de me le faire savoir rapidement par retour d’e-mail.`,
  3: `Malgré nos relances, la facture {{numero}} d’un montant de {{montant}}, échue le {{echeance}}, reste impayée à ce jour.

Je vous demande de procéder sans délai à son règlement. À défaut, je me verrai dans l’obligation d’engager les démarches de recouvrement prévues par la loi.`,
};

// Composition de l'e-mail final : structure fixe, valeurs issues de la base
export type ValeursRelance = Record<Balise, string>;

export function remplacerBalises(corps: string, valeurs: ValeursRelance): string {
  return corps.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (balise, nom: string) =>
    (BALISES as readonly string[]).includes(nom) ? valeurs[nom as Balise] : balise
  );
}

export type DonneesEmailRelance = {
  niveau: NiveauRelance;
  corps: string;
  valeurs: ValeursRelance;
  lienPaiement: string | null;
  signature: string;
};

export function sujetRelance(niveau: NiveauRelance, numero: string): string {
  if (niveau === 1) return `Rappel : facture n° ${numero}`;
  if (niveau === 2) return `Relance : facture n° ${numero} en attente de règlement`;
  return `Relance importante : facture n° ${numero} impayée`;
}

export function composerEmailRelance(donnees: DonneesEmailRelance) {
  const { niveau, valeurs, lienPaiement, signature } = donnees;
  const corps = remplacerBalises(donnees.corps.trim(), valeurs);

  const recapitulatif = [
    `Facture n° ${valeurs.numero}`,
    `Montant TTC : ${valeurs.montant}`,
    `Émise le ${valeurs.emise_le} · Échéance : ${valeurs.echeance}`,
  ];

  const blocs = [
    "Bonjour,",
    corps,
    recapitulatif.join("\n"),
    ...(lienPaiement ? [`Régler par carte bancaire : ${lienPaiement}`] : []),
    ...(niveau === 3 ? [MENTION_PENALITES] : []),
    PHRASE_DEJA_REGLE,
    signature.trim() || "Cordialement",
  ];

  const texte = blocs.join("\n\n");

  const html = [
    "<p>Bonjour,</p>",
    paragraphesHtml(corps),
    `<p style="padding:12px;background:#f3f4f6">${recapitulatif.map(echapperHtml).join("<br>")}</p>`,
    ...(lienPaiement
      ? [`<p><a href="${echapperHtml(lienPaiement)}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:4px">Régler par carte bancaire</a></p>`]
      : []),
    ...(niveau === 3 ? [`<p>${echapperHtml(MENTION_PENALITES)}</p>`] : []),
    `<p style="color:#6b7280">${echapperHtml(PHRASE_DEJA_REGLE)}</p>`,
    paragraphesHtml(signature.trim() || "Cordialement"),
  ].join("\n");

  return { sujet: sujetRelance(niveau, valeurs.numero), texte, html };
}
