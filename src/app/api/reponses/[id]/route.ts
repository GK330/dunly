import { estCategorie } from "@/lib/classification";
import { reponseErreurBase, reponseIntrouvable, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { ErreurValidation, estUuid, lireCorps } from "@/lib/validation";

// Correction par l'utilisateur de la catégorie proposée par l'IA
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("corriger une réponse");
  }

  if (!estUuid(id)) {
    return reponseIntrouvable("Réponse");
  }

  try {
    const corps = await lireCorps(request);

    // La catégorie doit appartenir à la liste fixe
    if (!estCategorie(corps.categorie)) {
      throw new ErreurValidation("Catégorie invalide.");
    }

    const { data, error } = await supabase
      .from("reponses_clients")
      .update({ categorie: corps.categorie, corrigee_par_utilisateur: true })
      .eq("id", id)
      .select("id, categorie")
      .maybeSingle();

    if (error) throw error;
    if (!data) return reponseIntrouvable("Réponse");

    return Response.json(data);
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la correction de la réponse");
  }
}
