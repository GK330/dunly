import * as Sentry from "@sentry/nextjs";
import { estAdministrateur } from "@/lib/admin";
import { creerClientServeur } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!estAdministrateur(user?.email)) {
    return Response.json({ erreur: "Accès réservé aux administrateurs." }, { status: 403 });
  }

  const date = new Date().toISOString();
  const erreur = new Error(`Erreur de test déclenchée depuis /admin le ${date}`);

  // Empreinte unique : chaque test crée une nouvelle issue, et donc une nouvelle alerte e-mail,
  // au lieu de s'ajouter à l'issue du test précédent
  const idEvenement = Sentry.captureException(erreur, {
    fingerprint: ["erreur-test-admin", date],
    tags: { origine: "bouton-admin" },
  });

  // La fonction serverless peut s'arrêter dès la réponse : l'événement part avant
  await Sentry.flush(3000);

  return Response.json(
    { erreur: "Erreur de test envoyée à Sentry.", idEvenement },
    { status: 500 }
  );
}
