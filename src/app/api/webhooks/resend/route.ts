import * as Sentry from "@sentry/nextjs";
import { publierTache } from "@/lib/qstash";
import {
  creerClientReception,
  relanceDepuisDestinataires,
  texteDepuisHtml,
} from "@/lib/reception";
import { creerClientAdmin } from "@/lib/supabase/admin";

const CORPS_MAX = 20000;

type EvenementRecu = {
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    received_for?: string[];
    subject?: string;
  };
};

// Webhook appelé par Resend à chaque e-mail reçu (événement email.received)
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET n'est pas définie : webhook refusé.");
    return Response.json({ erreur: "Webhook non configuré." }, { status: 500 });
  }

  // 1. Vérification de la signature, sur le corps brut (format Svix)
  const corps = await request.text();
  let evenement: EvenementRecu;

  try {
    evenement = creerClientReception().webhooks.verify({
      payload: corps,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    }) as unknown as EvenementRecu;
  } catch {
    return Response.json({ erreur: "Signature invalide." }, { status: 400 });
  }

  if (evenement.type !== "email.received") {
    return Response.json({ resultat: "ignoré" });
  }

  const { email_id, from, to, received_for, subject } = evenement.data;

  // 2. Rattachement à la relance grâce à l'adresse de réponse relance-<id>@…
  const relanceId = relanceDepuisDestinataires([...(to ?? []), ...(received_for ?? [])]);
  if (!relanceId) {
    return Response.json({ resultat: "ignoré : aucune relance associée" });
  }

  // Webhook sans session : client administrateur, filtré par l'identifiant de la relance
  const supabase = creerClientAdmin();
  const { data: relance } = await supabase
    .from("relances")
    .select("id, user_id, facture_id")
    .eq("id", relanceId)
    .maybeSingle();

  if (!relance) {
    return Response.json({ resultat: "ignoré : relance inconnue" });
  }

  try {
    // 3. Le webhook ne contient que les métadonnées : le corps est lu par l'API de réception
    const { data: email, error } = await creerClientReception().emails.receiving.get(email_id);
    if (error || !email) {
      throw new Error(`Lecture de l'e-mail reçu impossible : ${error?.message ?? "introuvable"}`);
    }

    const texte = (email.text?.trim() || texteDepuisHtml(email.html ?? "")).slice(0, CORPS_MAX);

    // 4. Enregistrement : l'identifiant Resend unique rend le webhook idempotent
    const { data: reponse, error: erreurInsertion } = await supabase
      .from("reponses_clients")
      .insert({
        user_id: relance.user_id,
        facture_id: relance.facture_id,
        relance_id: relance.id,
        expediteur: from.slice(0, 320),
        sujet: subject?.slice(0, 500) ?? null,
        corps: texte || "(message vide)",
        email_resend_id: email_id,
      })
      .select("id")
      .single();

    if (erreurInsertion) {
      if (erreurInsertion.code === "23505") {
        return Response.json({ resultat: "déjà reçu" });
      }
      throw erreurInsertion;
    }

    // 5. Classification en arrière-plan : le webhook répond tout de suite à Resend
    await publierTache(
      "/api/jobs/classer-reponse",
      { reponseId: reponse.id },
      { deduplicationId: `classer-${reponse.id}` }
    );

    return Response.json({ resultat: "enregistrée" });
  } catch (erreur) {
    console.error("Traitement de l'e-mail reçu impossible :", erreur);
    Sentry.captureException(erreur, { tags: { tache: "webhook-resend" } });

    // Code 500 : Resend renverra l'événement plus tard
    return Response.json({ erreur: "Erreur temporaire." }, { status: 500 });
  }
}
