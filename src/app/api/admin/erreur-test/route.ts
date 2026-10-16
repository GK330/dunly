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

  // Erreur volontaire, non gérée : Sentry la capture automatiquement
  throw new Error(`Erreur de test déclenchée depuis /admin le ${new Date().toISOString()}`);
}
