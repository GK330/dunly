import * as Sentry from "@sentry/nextjs";
import { chargerContexteRelance, composerRelance, estRelancable } from "@/lib/contexte-relance";
import { envoyerEmail } from "@/lib/email";
import { aujourdhuiParis } from "@/lib/facture";
import { NOMBRE_REESSAIS, verifierSignatureQStash } from "@/lib/qstash";
import type { StatutRelance } from "@/lib/relances";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { estUuid } from "@/lib/validation";

export const maxDuration = 30;

async function traiter(request: Request) {
  const { relanceId } = await request.json();
  const tentative = Number(request.headers.get("Upstash-Retried") ?? "0");

  if (!estUuid(relanceId)) {
    return Response.json({ resultat: "ignoré" });
  }

  // Le worker n'a pas d'utilisateur connecté : il utilise le client administrateur
  const supabase = creerClientAdmin();
  const contexte = await chargerContexteRelance(supabase, relanceId);
  if (!contexte) return Response.json({ resultat: "ignoré" });

  const { relance, facture, parametres } = contexte;
  const aujourdhui = aujourdhuiParis();

  // Avec la validation activée, seule une relance validée par l'utilisateur peut partir
  const autorises: StatutRelance[] = parametres.validation_relances
    ? ["validee"]
    : ["validee", "brouillon"];

  if (
    !autorises.includes(relance.statut) ||
    relance.envoyee_le !== null ||
    !relance.contenu ||
    relance.prevue_le > aujourdhui
  ) {
    return Response.json({ resultat: "ignoré" });
  }

  Sentry.setUser({ id: relance.user_id });

  // Dernière vérification juste avant l'envoi : payée, en pause ou arrêtée entre-temps ?
  const destinataire = facture.clients?.email;
  if (!estRelancable(facture, aujourdhui) || !destinataire) {
    await supabase
      .from("relances")
      .update({ statut: "annulee" })
      .eq("id", relance.id)
      .in("statut", autorises);
    return Response.json({ resultat: "annulée" });
  }

  // Réservation : un seul worker peut faire passer la relance à « envoyée ».
  // Si QStash livre le message deux fois, la seconde livraison ne trouve plus rien à envoyer.
  const { data: reservee } = await supabase
    .from("relances")
    .update({ statut: "envoyee", envoyee_le: new Date().toISOString() })
    .eq("id", relance.id)
    .in("statut", autorises)
    .is("envoyee_le", null)
    .select("id")
    .maybeSingle();

  if (!reservee) return Response.json({ resultat: "ignoré" });

  try {
    const email = composerRelance(contexte);

    await envoyerEmail({
      destinataire,
      sujet: email.sujet,
      html: email.html,
      texte: email.texte,
    });

    return Response.json({ resultat: "envoyée" });
  } catch (erreur) {
    console.error(`Échec de l'envoi de la relance (tentative ${tentative + 1}) :`, erreur);
    Sentry.captureException(erreur, {
      tags: { tache: "envoi-relance", tentative: String(tentative + 1) },
      extra: { relanceId: relance.id },
    });

    // L'e-mail n'est pas parti : la relance retrouve son statut, elle sera retentée
    await supabase
      .from("relances")
      .update({ statut: relance.statut, envoyee_le: null })
      .eq("id", relance.id);

    if (tentative < NOMBRE_REESSAIS) {
      return Response.json({ resultat: "nouvelle tentative" }, { status: 500 });
    }

    // Dernière tentative : la tournée de demain la reprendra
    return Response.json({ resultat: "erreur" });
  }
}

export const POST = verifierSignatureQStash(traiter);
