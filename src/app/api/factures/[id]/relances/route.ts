import { reponseErreurBase, reponseIntrouvable, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { preparerRelanceImmediate } from "@/lib/tournee-relances";
import { ErreurValidation, estUuid, lireCorps } from "@/lib/validation";

type Contexte = { params: Promise<{ id: string }> };

// Arrêter définitivement les relances d'une facture, ou les reprendre
export async function POST(request: Request, { params }: Contexte) {
  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("modifier les relances");
  }

  if (!estUuid(id)) {
    return reponseIntrouvable("Facture");
  }

  try {
    const corps = await lireCorps(request);

    if (corps.action !== "arreter" && corps.action !== "reprendre") {
      throw new ErreurValidation("Action invalide.");
    }

    const arreter = corps.action === "arreter";

    const { data, error } = await supabase
      .from("factures")
      .update({ relances_arretees: arreter, relances_en_pause_jusqu_au: null })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return reponseIntrouvable("Facture");

    // Les relances en attente d'envoi sont annulées immédiatement
    if (arreter) {
      await supabase
        .from("relances")
        .update({ statut: "annulee" })
        .eq("facture_id", id)
        .in("statut", ["brouillon", "validee"]);
    } else {
      // Relances reprises : la prochaine est préparée tout de suite si la facture est en retard
      preparerRelanceImmediate(id);
    }

    return Response.json({ relancesArretees: arreter });
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la modification des relances");
  }
}
