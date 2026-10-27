import * as Sentry from "@sentry/nextjs";
import { classerReponse } from "@/lib/classer-reponse";
import {
  actionPourCategorie,
  LIBELLES_CATEGORIE,
  nettoyerReponse,
  type Classification,
} from "@/lib/classification";
import { aujourdhuiParis } from "@/lib/facture";
import { estReessayable } from "@/lib/ia";
import { limiteurClassifications, verifierQuota } from "@/lib/limitation";
import { notifierUtilisateur } from "@/lib/notifications";
import { NOMBRE_REESSAIS, verifierSignatureQStash } from "@/lib/qstash";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { estUuid } from "@/lib/validation";

export const maxDuration = 60;

async function traiter(request: Request) {
  const { reponseId } = await request.json();
  const tentative = Number(request.headers.get("Upstash-Retried") ?? "0");

  if (!estUuid(reponseId)) {
    return Response.json({ resultat: "ignoré" });
  }

  // Le worker n'a pas d'utilisateur connecté : il utilise le client administrateur
  const supabase = creerClientAdmin();

  const { data: reponse } = await supabase
    .from("reponses_clients")
    .select("id, user_id, facture_id, expediteur, corps, categorie, factures(numero, statut)")
    .eq("id", reponseId)
    .maybeSingle();

  // Idempotence : une réponse déjà classée ne l'est pas une seconde fois
  if (!reponse || reponse.categorie !== null) {
    return Response.json({ resultat: "ignoré" });
  }

  Sentry.setUser({ id: reponse.user_id });
  const facture = reponse.factures as unknown as { numero: string; statut: string } | null;
  const aujourdhui = aujourdhuiParis();

  // 1. Classification par l'IA, validée contre la liste fixe des catégories.
  // Hors quota, aucune IA : la réponse est classée « autre » et l'utilisateur la lira.
  let classification: Classification = { categorie: "autre", date_promise: null };
  const quota = await verifierQuota(limiteurClassifications, reponse.user_id);

  if (quota.autorise) {
    try {
      classification = await classerReponse(nettoyerReponse(reponse.corps), aujourdhui, {
        id: reponse.id,
        nom: "classification-reponse",
        userId: reponse.user_id,
        metadata: { factureId: reponse.facture_id },
      });
    } catch (erreur) {
      console.error(`Échec de la classification (tentative ${tentative + 1}) :`, erreur);
      Sentry.captureException(erreur, {
        tags: { tache: "classification-reponse", tentative: String(tentative + 1) },
        extra: { reponseId: reponse.id },
      });

      if (estReessayable(erreur) && tentative < NOMBRE_REESSAIS) {
        return Response.json({ resultat: "nouvelle tentative" }, { status: 500 });
      }
      // IA indisponible : la réponse reste classée « autre », l'utilisateur décidera
    }
  }

  // 2. Actions automatiques prévues par le code : l'IA n'en déclenche aucune autre.
  // Une facture n'est JAMAIS marquée payée automatiquement.
  const action = actionPourCategorie(classification, aujourdhui);
  const facturePayee = facture?.statut === "payee";

  try {
    if (!facturePayee && (action.pauseJusquau || action.arreter)) {
      const { error } = await supabase
        .from("factures")
        .update(
          action.arreter
            ? { relances_arretees: true }
            : { relances_en_pause_jusqu_au: action.pauseJusquau }
        )
        .eq("id", reponse.facture_id)
        .eq("user_id", reponse.user_id);

      if (error) throw error;

      // Les relances en attente d'envoi sont annulées ; la tournée en recréera après la pause
      const { error: erreurRelances } = await supabase
        .from("relances")
        .update({ statut: "annulee" })
        .eq("facture_id", reponse.facture_id)
        .in("statut", ["brouillon", "validee"]);

      if (erreurRelances) throw erreurRelances;
    }

    const { error: erreurReponse } = await supabase
      .from("reponses_clients")
      .update({
        categorie: classification.categorie,
        date_promise: classification.date_promise,
        action_appliquee: [
          quota.autorise ? null : "Quota de classifications atteint : réponse non analysée par l’IA.",
          facturePayee ? "Facture déjà payée : aucune action." : action.description,
        ]
          .filter(Boolean)
          .join(" "),
      })
      .eq("id", reponse.id)
      .is("categorie", null);

    if (erreurReponse) throw erreurReponse;
  } catch (erreur) {
    console.error("Application des actions impossible :", erreur);
    Sentry.captureException(erreur, { tags: { tache: "actions-reponse" } });
    return Response.json({ resultat: "nouvelle tentative" }, { status: 500 });
  }

  // 3. Alerte à l'utilisateur (effet secondaire : un échec ne bloque pas le traitement)
  if (action.alerter) {
    try {
      const appUrl = process.env.APP_URL ?? "";
      await notifierUtilisateur(supabase, reponse.user_id, {
        sujet: `Réponse de votre client : ${LIBELLES_CATEGORIE[classification.categorie].libelle} (facture n° ${facture?.numero ?? "?"})`,
        texte: [
          `${reponse.expediteur} a répondu à votre relance pour la facture n° ${facture?.numero ?? "?"}.`,
          `Catégorie proposée par l'IA : ${LIBELLES_CATEGORIE[classification.categorie].libelle}.`,
          action.description,
          "Lisez la réponse et corrigez la catégorie si besoin.",
        ].join("\n\n"),
        liens: [
          { libelle: "Voir les réponses", url: `${appUrl}/reponses` },
          { libelle: "Voir la facture", url: `${appUrl}/factures/${reponse.facture_id}` },
        ],
      });
    } catch (erreur) {
      console.error("Échec de l'alerte :", erreur);
      Sentry.captureException(erreur, { level: "warning", tags: { tache: "alerte-reponse" } });
    }
  }

  return Response.json({ resultat: classification.categorie });
}

export const POST = verifierSignatureQStash(traiter);
