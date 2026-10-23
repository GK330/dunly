import { estAdministrateur } from "@/lib/admin";
import { publierTache, qstash } from "@/lib/qstash";
import { reponseErreurBase } from "@/lib/reponses-api";
import { creerClientServeur } from "@/lib/supabase/server";
import { CRON_TOURNEE, ID_PLANIFICATION, ROUTE_TOURNEE } from "@/lib/tournee-relances";
import { ErreurValidation, lireCorps } from "@/lib/validation";

// Administration de la tournée quotidienne des relances
export async function POST(request: Request) {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ erreur: "Authentification requise." }, { status: 401 });
  }

  if (!estAdministrateur(user.email)) {
    return Response.json({ erreur: "Accès réservé aux administrateurs." }, { status: 403 });
  }

  try {
    const corps = await lireCorps(request);
    const appUrl = process.env.APP_URL;

    if (!appUrl) {
      throw new ErreurValidation("La variable APP_URL n'est pas définie.");
    }

    // Crée (ou remplace) la planification quotidienne : l'identifiant fixe la rend idempotente
    if (corps.action === "planifier") {
      await qstash.schedules.create({
        scheduleId: ID_PLANIFICATION,
        destination: `${appUrl}${ROUTE_TOURNEE}`,
        cron: CRON_TOURNEE,
        retries: 3,
      });

      return Response.json({
        message: `Tournée planifiée chaque jour (cron « ${CRON_TOURNEE} », heure UTC) vers ${appUrl}${ROUTE_TOURNEE}.`,
      });
    }

    // Lance la tournée immédiatement, sans attendre la planification (démonstration, tests)
    if (corps.action === "lancer") {
      await publierTache(ROUTE_TOURNEE, {});
      return Response.json({ message: "Tournée des relances lancée." });
    }

    throw new ErreurValidation("Action invalide.");
  } catch (erreur) {
    if (erreur instanceof ErreurValidation) {
      return reponseErreurBase(erreur, "Administration des relances");
    }

    console.error("Erreur lors de l'administration des relances :", erreur);
    return Response.json(
      { erreur: "QStash n'a pas pu traiter la demande. Vérifiez sa configuration dans /admin." },
      { status: 502 }
    );
  }
}
