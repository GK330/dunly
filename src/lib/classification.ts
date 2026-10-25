import { ajouterJours } from "@/lib/facture";
import { estDateISO } from "@/lib/validation";

// Classification des réponses des clients : la liste des catégories est FIXE,
// et chaque catégorie ne déclenche qu'une action prévue à l'avance par le code.

export const CATEGORIES = [
  "promesse_paiement",
  "deja_paye",
  "contestation",
  "demande_delai",
  "autre",
] as const;

export type Categorie = (typeof CATEGORIES)[number];

export const LIBELLES_CATEGORIE: Record<Categorie, { libelle: string; classes: string }> = {
  promesse_paiement: { libelle: "Promesse de paiement", classes: "bg-green-100 text-green-800" },
  deja_paye: { libelle: "Dit avoir déjà payé", classes: "bg-abricot text-mandarine-fonce" },
  contestation: { libelle: "Contestation", classes: "bg-red-100 text-red-800" },
  demande_delai: { libelle: "Demande de délai", classes: "bg-yellow-100 text-yellow-800" },
  autre: { libelle: "Autre", classes: "bg-stone-100 text-stone-700" },
};

export function estCategorie(valeur: unknown): valeur is Categorie {
  return typeof valeur === "string" && (CATEGORIES as readonly string[]).includes(valeur);
}

// Une promesse au-delà de six mois n'est pas crédible : elle est ignorée
const PROMESSE_MAX_JOURS = 180;
const PAUSE_SANS_DATE_JOURS = 7;
const MARGE_PROMESSE_JOURS = 2;
const PAUSE_DEJA_PAYE_JOURS = 14;

export type Classification = { categorie: Categorie; date_promise: string | null };

// Valide la réponse du modèle. Tout ce qui sort du cadre devient « autre » :
// l'IA ne peut jamais imposer une catégorie ou une action inconnue.
export function validerClassification(donnees: unknown, aujourdhui: string): Classification {
  if (typeof donnees !== "object" || donnees === null) {
    return { categorie: "autre", date_promise: null };
  }

  const d = donnees as Record<string, unknown>;

  if (!estCategorie(d.categorie)) {
    return { categorie: "autre", date_promise: null };
  }

  let date_promise: string | null = null;
  if (
    d.categorie === "promesse_paiement" &&
    estDateISO(d.date_promise) &&
    d.date_promise >= aujourdhui &&
    d.date_promise <= ajouterJours(aujourdhui, PROMESSE_MAX_JOURS)
  ) {
    date_promise = d.date_promise;
  }

  return { categorie: d.categorie, date_promise };
}

export type Action = {
  pauseJusquau: string | null;
  arreter: boolean;
  alerter: boolean;
  description: string;
};

// Seules actions possibles, décidées par le code. Aucune ne marque une facture payée :
// c'est toujours l'utilisateur qui le confirme.
export function actionPourCategorie(
  classification: Classification,
  aujourdhui: string
): Action {
  switch (classification.categorie) {
    case "promesse_paiement": {
      const pause = classification.date_promise
        ? ajouterJours(classification.date_promise, MARGE_PROMESSE_JOURS)
        : ajouterJours(aujourdhui, PAUSE_SANS_DATE_JOURS);
      return {
        pauseJusquau: pause,
        arreter: false,
        alerter: false,
        description: classification.date_promise
          ? "Relances en pause jusqu’à la date promise + 2 jours."
          : "Relances en pause pendant 7 jours (aucune date promise).",
      };
    }
    case "deja_paye":
      return {
        pauseJusquau: ajouterJours(aujourdhui, PAUSE_DEJA_PAYE_JOURS),
        arreter: false,
        alerter: true,
        description:
          "Relances en pause 14 jours. Vérifiez le paiement puis marquez la facture payée vous-même.",
      };
    case "contestation":
      return {
        pauseJusquau: null,
        arreter: true,
        alerter: true,
        description: "Relances arrêtées : le client conteste la facture.",
      };
    case "demande_delai":
      return {
        pauseJusquau: null,
        arreter: false,
        alerter: true,
        description: "Aucune action automatique : à vous de décider du délai.",
      };
    default:
      return {
        pauseJusquau: null,
        arreter: false,
        alerter: true,
        description: "Aucune action automatique : réponse à lire.",
      };
  }
}

// Le contenu de l'e-mail est une DONNÉE : il est placé entre des délimiteurs
// aléatoires, et toute tentative d'imiter ces délimiteurs est neutralisée.
export function delimiterEmail(corps: string, jeton: string): string {
  const neutralise = corps.replace(/<{2,}|>{2,}/g, " ").slice(0, 4000);
  return `<<<EMAIL_CLIENT_${jeton}>>>\n${neutralise}\n<<<FIN_EMAIL_CLIENT_${jeton}>>>`;
}

// Retire la citation du message précédent (notre relance), pour ne classer que la réponse
export function nettoyerReponse(texte: string): string {
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  const fin = lignes.findIndex(
    (ligne) =>
      /^\s*(le .+ a écrit|on .+ wrote)\s*:?\s*$/i.test(ligne) ||
      /^-{2,}\s*(message d'origine|original message)/i.test(ligne.trim())
  );

  return (fin >= 0 ? lignes.slice(0, fin) : lignes)
    .filter((ligne) => !ligne.trimStart().startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
