import { verifierSaisie } from "@/lib/relances";
import { reponseErreurBase, reponseIntrouvable, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { ErreurValidation, estUuid, lireCorps } from "@/lib/validation";

type Contexte = { params: Promise<{ id: string }> };

// Modification du texte d'une relance par l'utilisateur, avant son envoi
export async function PATCH(request: Request, { params }: Contexte) {
  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("modifier une relance");
  }

  if (!estUuid(id)) {
    return reponseIntrouvable("Relance");
  }

  try {
    const corps = await lireCorps(request);
    const contenu = typeof corps.contenu === "string" ? corps.contenu.trim() : "";

    // Balises connues et complètes uniquement : elles seront remplacées par les valeurs de la base
    const { erreurs } = verifierSaisie(contenu);
    if (erreurs.length > 0) {
      throw new ErreurValidation(erreurs[0]);
    }

    // Une relance déjà envoyée ou annulée ne se modifie plus
    const { data, error } = await supabase
      .from("relances")
      .update({ contenu, origine_contenu: "utilisateur", message_generation: null })
      .eq("id", id)
      .in("statut", ["brouillon", "validee"])
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new ErreurValidation("Cette relance n'est plus modifiable.");
    }

    return Response.json({ enregistre: true });
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la modification de la relance");
  }
}
