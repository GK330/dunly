import * as Sentry from "@sentry/nextjs";
import { aujourdhuiParis } from "@/lib/facture";
import { publierTache } from "@/lib/qstash";
import { reponseErreurBase, reponseIntrouvable, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { ErreurValidation, estUuid } from "@/lib/validation";

// « Valider et envoyer maintenant » : l'utilisateur a relu la relance, elle part tout de suite
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("envoyer une relance");
  }

  if (!estUuid(id)) {
    return reponseIntrouvable("Relance");
  }

  try {
    // Validée et prévue aujourd'hui, avec la session de l'utilisateur : la RLS garantit
    // qu'il ne peut envoyer que ses propres relances, et seulement si leur texte est rédigé
    const { data, error } = await supabase
      .from("relances")
      .update({ statut: "validee", prevue_le: aujourdhuiParis() })
      .eq("id", id)
      .in("statut", ["brouillon", "validee"])
      .not("contenu", "is", null)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new ErreurValidation("Cette relance ne peut plus être envoyée.");
    }
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la validation de la relance");
  }

  // L'envoi lui-même est confié au worker, qui revérifie la facture juste avant d'envoyer
  try {
    await publierTache(
      "/api/jobs/envoyer-relance",
      { relanceId: id },
      { deduplicationId: `envoyer-${id}-${aujourdhuiParis()}` }
    );
  } catch (erreur) {
    console.error("Erreur lors de la publication de l'envoi :", erreur);
    Sentry.captureException(erreur, { tags: { tache: "publication-qstash" } });
    return Response.json(
      {
        erreur:
          "La relance est validée, mais son envoi n'a pas pu être lancé : elle partira lors de la prochaine tournée.",
      },
      { status: 503 }
    );
  }

  return Response.json({ message: "Relance en cours d'envoi." }, { status: 202 });
}
