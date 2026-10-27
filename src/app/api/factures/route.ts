import { COLONNES_FACTURE } from "@/lib/facture";
import { reponseErreurBase, reponseNonConnecte } from "@/lib/reponses-api";
import { lireSaisieFacture } from "@/lib/saisie-facture";
import { creerClientServeur } from "@/lib/supabase/server";
import { preparerRelanceImmediate } from "@/lib/tournee-relances";
import { lireCorps } from "@/lib/validation";

// Création d'une facture saisie à la main
export async function POST(request: Request) {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("créer une facture");
  }

  try {
    const corps = await lireCorps(request);
    const saisie = await lireSaisieFacture(supabase, corps);

    const { data, error } = await supabase
      .from("factures")
      .insert(saisie)
      .select(COLONNES_FACTURE)
      .single();

    if (error) throw error;

    // Facture déjà en retard : sa relance est préparée tout de suite
    preparerRelanceImmediate(data.id);

    return Response.json(data, { status: 201 });
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la création de la facture", {
      doublon: "Une facture porte déjà ce numéro.",
    });
  }
}
