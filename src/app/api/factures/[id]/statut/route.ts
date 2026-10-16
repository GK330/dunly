import { COLONNES_FACTURE } from "@/lib/facture";
import { reponseErreurBase, reponseIntrouvable, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { ErreurValidation, estUuid, lireCorps } from "@/lib/validation";

type Contexte = { params: Promise<{ id: string }> };

// « Marquer payée » (ou annuler ce marquage en cas d'erreur)
export async function POST(request: Request, { params }: Contexte) {
  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("modifier une facture");
  }

  if (!estUuid(id)) {
    return reponseIntrouvable("Facture");
  }

  try {
    const corps = await lireCorps(request);

    if (corps.statut !== "payee" && corps.statut !== "en_attente") {
      throw new ErreurValidation("Statut invalide.");
    }

    const payee = corps.statut === "payee";

    // Seule une facture validée peut changer de statut, et seulement si elle ne l'a pas déjà
    const { data, error } = await supabase
      .from("factures")
      .update({ statut: corps.statut, payee_le: payee ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("brouillon", false)
      .eq("statut", payee ? "en_attente" : "payee")
      .select(COLONNES_FACTURE)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new ErreurValidation("Cette facture a déjà ce statut, ou n'est pas encore validée.");
    }

    return Response.json(data);
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors du changement de statut de la facture");
  }
}
