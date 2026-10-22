export type StatutFacture = "en_attente" | "payee";

export type AnalyseFacture = "en_cours" | "prete" | "erreur";

// Statut affiché : « en retard » se calcule, il n'est jamais stocké
export type StatutAffiche = "brouillon" | "en_attente" | "en_retard" | "payee";

export type Facture = {
  id: string;
  client_id: string | null;
  numero: string | null;
  montant_ttc: number | null;
  emise_le: string | null;
  echeance: string | null;
  statut: StatutFacture;
  payee_le: string | null;
  brouillon: boolean;
  etat_analyse: AnalyseFacture | null;
  message_erreur: string | null;
  created_at: string;
};

export const COLONNES_FACTURE =
  "id, client_id, numero, montant_ttc, emise_le, echeance, statut, payee_le, brouillon, etat_analyse, message_erreur, created_at";

export type Client = {
  id: string;
  nom: string;
  email: string | null;
  created_at: string;
};

export const LIMITES = {
  nomMax: 150,
  emailMax: 254,
  numeroMax: 50,
  montantMax: 10_000_000,
};

export const LIBELLES_STATUT: Record<StatutAffiche, { libelle: string; classes: string }> = {
  brouillon: { libelle: "À vérifier", classes: "bg-stone-100 text-stone-800" },
  en_attente: { libelle: "En attente", classes: "bg-amber-100 text-amber-900" },
  en_retard: { libelle: "En retard", classes: "bg-red-100 text-red-800" },
  payee: { libelle: "Payée", classes: "bg-green-100 text-green-800" },
};

// Date du jour à Paris, au format AAAA-MM-JJ : les échéances sont des dates françaises
export function aujourdhuiParis(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Nombre de jours entre deux dates AAAA-MM-JJ (positif si fin est après debut)
export function joursEntre(debut: string, fin: string): number {
  const [a1, m1, j1] = debut.split("-").map(Number);
  const [a2, m2, j2] = fin.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, j2) - Date.UTC(a1, m1 - 1, j1)) / 86_400_000);
}

export function ajouterJours(date: string, jours: number): string {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + jours)).toISOString().slice(0, 10);
}

export function statutAffiche(
  facture: Pick<Facture, "brouillon" | "statut" | "echeance">,
  aujourdhui: string
): StatutAffiche {
  if (facture.brouillon) return "brouillon";
  if (facture.statut === "payee") return "payee";
  if (facture.echeance && facture.echeance < aujourdhui) return "en_retard";
  return "en_attente";
}

export function joursDeRetard(
  facture: Pick<Facture, "brouillon" | "statut" | "echeance">,
  aujourdhui: string
): number {
  if (statutAffiche(facture, aujourdhui) !== "en_retard") return 0;
  return joursEntre(facture.echeance!, aujourdhui);
}

const FORMAT_MONTANT = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formaterMontant(montant: number | null): string {
  return montant === null ? "—" : FORMAT_MONTANT.format(montant);
}

export function formaterDate(date: string | null): string {
  if (!date) return "—";
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
  });
}
