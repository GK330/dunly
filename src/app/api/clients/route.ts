import { LIMITES } from "@/lib/facture";
import { reponseErreurBase, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { emailFacultatif, lireCorps, texteObligatoire } from "@/lib/validation";

export async function POST(request: Request) {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("créer un client");
  }

  try {
    const corps = await lireCorps(request);
    const nom = texteObligatoire(corps.nom, "Le nom du client", LIMITES.nomMax);
    const email = emailFacultatif(corps.email);

    // Enregistré au nom de l'utilisateur connecté : user_id est rempli par la base
    const { data, error } = await supabase
      .from("clients")
      .insert({ nom, email })
      .select("id, nom, email, created_at")
      .single();

    if (error) throw error;

    return Response.json(data, { status: 201 });
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la création du client");
  }
}
