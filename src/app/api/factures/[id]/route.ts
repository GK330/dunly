import { COLONNES_FACTURE } from "@/lib/facture";
import { reponseErreurBase, reponseIntrouvable, reponseNonConnecte } from "@/lib/reponses-api";
import { lireSaisieFacture } from "@/lib/saisie-facture";
import { creerClientServeur } from "@/lib/supabase/server";
import { preparerRelanceImmediate } from "@/lib/tournee-relances";
import { ErreurValidation, estUuid, lireCorps } from "@/lib/validation";

type Contexte = { params: Promise<{ id: string }> };

// Modification d'une facture, ou validation d'un brouillon issu d'un PDF
export async function PATCH(request: Request, { params }: Contexte) {
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
    const { data: facture } = await supabase
      .from("factures")
      .select("id, etat_analyse")
      .eq("id", id)
      .maybeSingle();

    if (!facture) return reponseIntrouvable("Facture");

    if (facture.etat_analyse === "en_cours") {
      throw new ErreurValidation("La lecture du PDF est en cours : patientez avant de modifier la facture.");
    }

    const corps = await lireCorps(request);
    const saisie = await lireSaisieFacture(supabase, corps);

    // Une facture complète et vérifiée par l'utilisateur n'est plus un brouillon
    const { data, error } = await supabase
      .from("factures")
      .update({ ...saisie, brouillon: false })
      .eq("id", id)
      .select(COLONNES_FACTURE)
      .single();

    if (error) throw error;

    // Facture validée et déjà en retard : sa relance est préparée tout de suite
    preparerRelanceImmediate(id);

    return Response.json(data);
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la modification de la facture", {
      doublon: "Une facture porte déjà ce numéro.",
    });
  }
}

export async function DELETE(_request: Request, { params }: Contexte) {
  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("supprimer une facture");
  }

  if (!estUuid(id)) {
    return reponseIntrouvable("Facture");
  }

  try {
    const { data, error } = await supabase
      .from("factures")
      .delete()
      .eq("id", id)
      .select("id, fichier_chemin")
      .maybeSingle();

    if (error) throw error;
    if (!data) return reponseIntrouvable("Facture");

    // Le PDF d'origine est supprimé ensuite : s'il échoue, la facture est déjà supprimée,
    // et seul un fichier orphelin reste dans le dossier privé de l'utilisateur
    if (data.fichier_chemin) {
      const { error: erreurStockage } = await supabase.storage
        .from("factures")
        .remove([data.fichier_chemin]);

      if (erreurStockage) {
        console.error("PDF non supprimé :", erreurStockage);
      }
    }

    return Response.json({ supprime: true });
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la suppression de la facture");
  }
}
