import * as Sentry from "@sentry/nextjs";
import { estCheminPdfValide } from "@/lib/pdf";
import { publierTache } from "@/lib/qstash";
import { reponseErreurBase, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireCorps } from "@/lib/validation";

// Import d'une facture PDF déjà déposée par le navigateur dans le bucket privé « factures »
export async function POST(request: Request) {
  // 0. Vérification de la session
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return reponseNonConnecte("importer une facture");
  }

  let cheminFichier: string;
  try {
    const corps = await lireCorps(request);

    // 1. Le fichier doit se trouver dans le dossier de l'utilisateur : une clé fabriquée est refusée
    if (!estCheminPdfValide(corps.cheminFichier, user.id)) {
      return Response.json({ erreur: "Fichier invalide." }, { status: 400 });
    }

    cheminFichier = corps.cheminFichier;
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la lecture de la demande d'import");
  }

  // 2. Enregistrement d'un brouillon, avec le statut d'analyse « en cours »
  const { data: facture, error } = await supabase
    .from("factures")
    .insert({ brouillon: true, etat_analyse: "en_cours", fichier_chemin: cheminFichier })
    .select("id, etat_analyse")
    .single();

  if (error || !facture) {
    console.error("Erreur lors de l'enregistrement de l'import :", error);
    return Response.json(
      { erreur: "L'import n'a pas pu être enregistré. Réessayez plus tard." },
      { status: 500 }
    );
  }

  // 3. Publication du message de lecture dans la file
  try {
    await publierTache(
      "/api/jobs/analyser-facture",
      { factureId: facture.id },
      { deduplicationId: `analyse-${facture.id}` }
    );
  } catch (erreur) {
    console.error("Erreur lors de la publication du message :", erreur);
    Sentry.captureException(erreur, { tags: { tache: "publication-qstash" } });

    // Traitement système, sans utilisateur : usage légitime du client administrateur
    await creerClientAdmin()
      .from("factures")
      .update({ etat_analyse: "erreur", message_erreur: "La lecture du PDF n'a pas pu être lancée." })
      .eq("id", facture.id);

    return Response.json(
      { erreur: "La lecture du PDF n'a pas pu être lancée. Réessayez plus tard." },
      { status: 503 }
    );
  }

  // 4. Réponse immédiate : la lecture se poursuit en arrière-plan
  return Response.json(facture, { status: 202 });
}
