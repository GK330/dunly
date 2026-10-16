import { LIMITES } from "@/lib/facture";
import { reponseErreurBase, reponseIntrouvable, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { emailFacultatif, ErreurValidation, estUuid, texteObligatoire } from "@/lib/validation";

type Contexte = { params: Promise<{ id: string }> };

// Crée le client détecté par l'IA dans le PDF, et le rattache au brouillon de facture
export async function POST(_request: Request, { params }: Contexte) {
  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("créer un client");
  }

  if (!estUuid(id)) {
    return reponseIntrouvable("Facture");
  }

  try {
    const { data: facture } = await supabase
      .from("factures")
      .select("id, brouillon, client_id, donnees_extraites")
      .eq("id", id)
      .maybeSingle();

    if (!facture) return reponseIntrouvable("Facture");

    if (!facture.brouillon || facture.client_id) {
      throw new ErreurValidation("Cette facture a déjà un client.");
    }

    // Les données extraites sont revalidées avant d'être enregistrées
    const extraites = (facture.donnees_extraites ?? {}) as Record<string, unknown>;
    const nom = texteObligatoire(extraites.client_nom, "Le nom du client détecté", LIMITES.nomMax);
    const email = emailFacultatif(extraites.client_email);

    const { data: client, error } = await supabase
      .from("clients")
      .insert({ nom, email })
      .select("id")
      .single();

    if (error) throw error;

    const { error: erreurRattachement } = await supabase
      .from("factures")
      .update({ client_id: client.id })
      .eq("id", id);

    if (erreurRattachement) throw erreurRattachement;

    return Response.json({ clientId: client.id }, { status: 201 });
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la création du client détecté");
  }
}
