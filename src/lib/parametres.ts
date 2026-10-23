import "server-only";
import type { ClientAdmin } from "@/lib/supabase/admin";
import type { ClientServeur } from "@/lib/supabase/server";

export type Parametres = {
  nom_affiche: string;
  signature: string;
  taux_cotisations: number;
  validation_relances: boolean;
  paiement_carte_actif: boolean;
};

// Valeurs utilisées tant que l'utilisateur n'a pas enregistré ses paramètres
export const PARAMETRES_PAR_DEFAUT: Parametres = {
  nom_affiche: "",
  signature: "",
  taux_cotisations: 0.246,
  validation_relances: true,
  paiement_carte_actif: true,
};

export const COLONNES_PARAMETRES =
  "nom_affiche, signature, taux_cotisations, validation_relances, paiement_carte_actif";

// Avec le client serveur, la Row Level Security limite la lecture aux paramètres de l'utilisateur ;
// avec le client administrateur (tâches en arrière-plan), le filtre sur user_id est indispensable
export async function lireParametres(
  supabase: ClientServeur | ClientAdmin,
  userId: string
): Promise<Parametres> {
  const { data } = await supabase
    .from("parametres")
    .select(COLONNES_PARAMETRES)
    .eq("user_id", userId)
    .maybeSingle();

  const parametres = { ...PARAMETRES_PAR_DEFAUT, ...(data ?? {}) } as Parametres;
  // Un numeric PostgreSQL peut arriver sous forme de chaîne selon la configuration de l'API
  parametres.taux_cotisations = Number(parametres.taux_cotisations);
  return parametres;
}

// Signature des relances : celle saisie par l'utilisateur, à défaut son nom
export function signatureRelances(parametres: Parametres): string {
  return parametres.signature.trim() || (parametres.nom_affiche.trim() ? `Cordialement,\n${parametres.nom_affiche.trim()}` : "");
}
