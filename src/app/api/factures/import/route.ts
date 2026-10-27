import * as Sentry from "@sentry/nextjs";
import { entetesQuota, limiteurAnalyses, verifierQuota } from "@/lib/limitation";
import { estCheminPdfValide } from "@/lib/pdf";
import { publierTache } from "@/lib/qstash";
import { reponseErreurBase, reponseNonConnecte } from "@/lib/reponses-api";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireCorps } from "@/lib/validation";

// Import d'une facture PDF déjà déposée par le navigateur dans le bucket privé « factures »
export async function POST(request: Request) {
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

    // Le fichier doit se trouver dans le dossier de l'utilisateur : une clé fabriquée est refusée
    if (!estCheminPdfValide(corps.cheminFichier, user.id)) {
      return Response.json({ erreur: "Fichier invalide." }, { status: 400 });
    }

    cheminFichier = corps.cheminFichier;
  } catch (erreur) {
    return reponseErreurBase(erreur, "Erreur lors de la lecture de la demande d'import");
  }

  // Vérification du quota de l'utilisateur, avant tout appel coûteux au modèle d'IA
  const quota = await verifierQuota(limiteurAnalyses, user.id);
  const enTetesQuota = entetesQuota(quota);

  if (!quota.autorise) {
    // Le PDF déjà déposé ne sera pas lu : il ne reste pas dans le stockage
    await creerClientAdmin().storage.from("factures").remove([cheminFichier]);
    const minutes = Math.ceil(quota.secondesAvantReinitialisation / 60);
    return Response.json(
      {
        erreur: `Vous avez atteint votre quota de ${quota.limite} lectures de PDF par heure. Réessayez dans ${minutes} minute(s), ou saisissez la facture à la main.`,
      },
      {
        status: 429,
        headers: { ...enTetesQuota, "Retry-After": String(quota.secondesAvantReinitialisation) },
      }
    );
  }

  // Enregistrement d'un brouillon, avec le statut d'analyse « en cours »
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

  // Publication du message de lecture dans la file
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

  // Réponse immédiate : la lecture se poursuit en arrière-plan
  return Response.json(facture, { status: 202, headers: enTetesQuota });
}
