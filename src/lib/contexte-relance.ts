import "server-only";
import { formaterDate, formaterMontant } from "@/lib/facture";
import { lireParametres, signatureRelances, type Parametres } from "@/lib/parametres";
import {
  composerEmailRelance,
  type NiveauRelance,
  type OrigineContenu,
  type StatutRelance,
  type ValeursRelance,
} from "@/lib/relances";
import type { ClientAdmin } from "@/lib/supabase/admin";
import type { ClientServeur } from "@/lib/supabase/server";

export type FactureRelancee = {
  id: string;
  user_id: string;
  client_id: string;
  numero: string;
  montant_ttc: number;
  emise_le: string;
  echeance: string;
  statut: "en_attente" | "payee";
  brouillon: boolean;
  jeton_paiement: string;
  relances_en_pause_jusqu_au: string | null;
  relances_arretees: boolean;
  clients: { nom: string; email: string | null } | null;
};

export type Relance = {
  id: string;
  user_id: string;
  facture_id: string;
  niveau: NiveauRelance;
  statut: StatutRelance;
  prevue_le: string;
  contenu: string | null;
  origine_contenu: OrigineContenu | null;
  message_generation: string | null;
  envoyee_le: string | null;
  veille_notifiee_le: string | null;
  created_at: string;
};

export const COLONNES_RELANCE =
  "id, user_id, facture_id, niveau, statut, prevue_le, contenu, origine_contenu, message_generation, envoyee_le, veille_notifiee_le, created_at";

const COLONNES_FACTURE_RELANCEE =
  "id, user_id, client_id, numero, montant_ttc, emise_le, echeance, statut, brouillon, jeton_paiement, relances_en_pause_jusqu_au, relances_arretees, clients(nom, email)";

export type ContexteRelance = {
  relance: Relance;
  facture: FactureRelancee;
  parametres: Parametres;
};

// Charge une relance avec sa facture, son client et les paramètres de l'indépendant.
// Avec le client serveur, la Row Level Security garantit que tout appartient à l'utilisateur.
export async function chargerContexteRelance(
  supabase: ClientAdmin | ClientServeur,
  relanceId: string
): Promise<ContexteRelance | null> {
  const { data: relance } = await supabase
    .from("relances")
    .select(COLONNES_RELANCE)
    .eq("id", relanceId)
    .maybeSingle<Relance>();

  if (!relance) return null;

  const { data } = await supabase
    .from("factures")
    .select(COLONNES_FACTURE_RELANCEE)
    .eq("id", relance.facture_id)
    .maybeSingle();

  const facture = data as unknown as FactureRelancee | null;
  if (!facture) return null;

  const parametres = await lireParametres(supabase, relance.user_id);

  return { relance, facture, parametres };
}

// Une facture ne se relance que si elle est validée, en retard, non payée,
// et si les relances ne sont ni arrêtées ni en pause
export function estRelancable(facture: FactureRelancee, aujourdhui: string): boolean {
  return (
    facture.statut === "en_attente" &&
    !facture.brouillon &&
    !facture.relances_arretees &&
    !(facture.relances_en_pause_jusqu_au && facture.relances_en_pause_jusqu_au >= aujourdhui) &&
    facture.echeance < aujourdhui
  );
}

// Les valeurs insérées dans le message viennent toujours de la base, jamais de l'IA
export function valeursDepuisBase(facture: FactureRelancee): ValeursRelance {
  return {
    client: facture.clients?.nom ?? "",
    numero: facture.numero,
    montant: formaterMontant(Number(facture.montant_ttc)),
    emise_le: formaterDate(facture.emise_le),
    echeance: formaterDate(facture.echeance),
  };
}

// Le paiement par carte (Stripe) arrive à l'étape 6 : d'ici là, aucune relance
// ne contient de lien, plutôt qu'un lien vers une page qui n'existe pas encore
export function lienPaiement(): string | null {
  return null;
}

export function composerRelance({ relance, facture, parametres }: ContexteRelance) {
  return composerEmailRelance({
    niveau: relance.niveau,
    corps: relance.contenu ?? "",
    valeurs: valeursDepuisBase(facture),
    lienPaiement: lienPaiement(),
    signature: signatureRelances(parametres),
  });
}
