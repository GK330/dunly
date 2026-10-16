import "server-only";
import type { ClientAdmin } from "@/lib/supabase/admin";
import type { ClientServeur } from "@/lib/supabase/server";

export type Parametres = {
  nom_affiche: string;
  signature: string;
  taux_cotisations: number;
};

// Valeurs utilisées tant que l'utilisateur n'a pas enregistré ses paramètres
export const PARAMETRES_PAR_DEFAUT: Parametres = {
  nom_affiche: "",
  signature: "",
  taux_cotisations: 0.246,
};

export const COLONNES_PARAMETRES = "nom_affiche, signature, taux_cotisations";

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
