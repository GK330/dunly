import * as Sentry from "@sentry/nextjs";
import { aujourdhuiParis } from "@/lib/facture";
import { verifierSignatureQStash } from "@/lib/qstash";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { preparerRelances, publierEnvois } from "@/lib/tournee-relances";

export const maxDuration = 60;

// Appelée chaque jour par la planification QStash : aucune session, client administrateur
async function traiter() {
  const supabase = creerClientAdmin();
  const aujourdhui = aujourdhuiParis();

  try {
    const preparation = await preparerRelances(supabase, aujourdhui);
    const envois = await publierEnvois(supabase, aujourdhui);

    return Response.json({ aujourdhui, ...preparation, ...envois });
  } catch (erreur) {
    console.error("Échec de la tournée des relances :", erreur);
    Sentry.captureException(erreur, { tags: { tache: "tournee-relances" } });

    // Code 500 : QStash réessaiera. Les étapes déjà faites ne sont pas refaites (idempotence)
    return Response.json({ resultat: "nouvelle tentative" }, { status: 500 });
  }
}

export const POST = verifierSignatureQStash(traiter);
