import { LIMITES } from "@/lib/facture";
import { reponseErreurBase, reponseIntrouvable, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { emailFacultatif, estUuid, lireCorps, texteObligatoire } from "@/lib/validation";

type Contexte = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Contexte) {
  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("modifier un client");
  }

  if (!estUuid(id)) {
    return reponseIntrouvable("Client");
  }

  try {
    const corps = await lireCorps(request);
    const nom = texteObligatoire(corps.nom, "Le nom du client", LIMITES.nomMax);
    const email = emailFacultatif(corps.email);

    // La Row Level Security garantit que seul un client de l'utilisateur peut être modifié
    const { data, error } = await supabase
      .from("clients")
      .update({ nom, email })
      .eq("id", id)
      .select("id, nom, email, created_at")
      .maybeSingle();

    if (error) throw error;
    if (!data) return reponseIntrouvable("Client");

    return Response.json(data);
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la modification du client");
  }
}

export async function DELETE(_request: Request, { params }: Contexte) {
  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("supprimer un client");
  }

  if (!estUuid(id)) {
    return reponseIntrouvable("Client");
  }

  try {
    const { data, error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return reponseIntrouvable("Client");

    return Response.json({ supprime: true });
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la suppression du client", {
      reference:
        "Ce client a encore des factures : supprimez-les ou rattachez-les à un autre client d’abord.",
    });
  }
}
