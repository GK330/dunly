import * as Sentry from "@sentry/nextjs";
import type Stripe from "stripe";
import { formaterMontant } from "@/lib/facture";
import { notifierUtilisateur } from "@/lib/notifications";
import { creerClientStripe } from "@/lib/stripe";
import { creerClientAdmin, type ClientAdmin } from "@/lib/supabase/admin";
import { estUuid } from "@/lib/validation";

// Seuls ces événements font passer une facture en « payée »
const EVENEMENTS_PAIEMENT = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
];

async function enregistrerPaiement(supabase: ClientAdmin, session: Stripe.Checkout.Session) {
  const factureId = session.metadata?.facture_id;

  if (!estUuid(factureId)) {
    console.warn("Session Stripe sans facture associée :", session.id);
    return "ignoré";
  }

  const { data: facture } = await supabase
    .from("factures")
    .select("id, user_id, numero, montant_ttc, statut")
    .eq("id", factureId)
    .maybeSingle();

  if (!facture) return "ignoré";

  // Vérification de cohérence : le montant payé doit être celui de la facture en base
  const attendu = Math.round(Number(facture.montant_ttc) * 100);
  if (session.amount_total !== attendu || session.currency !== "eur") {
    Sentry.captureMessage("Montant payé différent du montant de la facture", {
      level: "error",
      extra: { factureId, attendu, recu: session.amount_total, devise: session.currency },
    });
    return "montant incohérent";
  }

  const { data: payee, error } = await supabase
    .from("factures")
    .update({
      statut: "payee",
      payee_le: new Date().toISOString(),
      payee_par_carte: true,
      stripe_session_id: session.id,
    })
    .eq("id", facture.id)
    .eq("statut", "en_attente")
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!payee) return "déjà payée";

  // Facture payée : toutes ses relances en attente sont annulées
  const { error: erreurRelances } = await supabase
    .from("relances")
    .update({ statut: "annulee" })
    .eq("facture_id", facture.id)
    .in("statut", ["brouillon", "validee"]);

  if (erreurRelances) throw erreurRelances;

  // Effet secondaire : un échec de notification ne remet pas en cause le paiement
  try {
    await notifierUtilisateur(supabase, facture.user_id, {
      sujet: `Facture n° ${facture.numero} payée par carte`,
      texte: `Bonne nouvelle : votre client a réglé la facture n° ${facture.numero} (${formaterMontant(Number(facture.montant_ttc))}) par carte bancaire. Elle est marquée comme payée et ses relances sont arrêtées.`,
      liens: [{ libelle: "Voir la facture", url: `${process.env.APP_URL}/factures/${facture.id}` }],
    });
  } catch (erreur) {
    console.error("Échec de la notification de paiement :", erreur);
    Sentry.captureException(erreur, { level: "warning", tags: { tache: "notification-paiement" } });
  }

  return "payée";
}

// Webhook appelé par Stripe : la seule source de vérité pour passer une facture en « payée »
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!secret || !signature) {
    return Response.json({ erreur: "Signature absente." }, { status: 400 });
  }

  // Le corps brut est indispensable : la signature porte sur les octets exacts reçus
  const corps = await request.text();

  let evenement: Stripe.Event;
  try {
    evenement = creerClientStripe().webhooks.constructEvent(corps, signature, secret);
  } catch (erreur) {
    console.warn("Webhook Stripe refusé :", erreur instanceof Error ? erreur.message : erreur);
    return Response.json({ erreur: "Signature invalide." }, { status: 400 });
  }

  if (!EVENEMENTS_PAIEMENT.includes(evenement.type)) {
    return Response.json({ resultat: "ignoré" });
  }

  const supabase = creerClientAdmin();

  // Idempotence : l'identifiant de l'événement est enregistré avant tout traitement.
  // Si Stripe renvoie le même événement, l'insertion échoue et rien n'est refait.
  const { error: erreurEvenement } = await supabase
    .from("evenements_stripe")
    .insert({ id: evenement.id, type: evenement.type });

  if (erreurEvenement) {
    if (erreurEvenement.code === "23505") {
      return Response.json({ resultat: "déjà traité" });
    }
    console.error("Enregistrement de l'événement Stripe impossible :", erreurEvenement);
    return Response.json({ erreur: "Erreur temporaire." }, { status: 500 });
  }

  try {
    const session = evenement.data.object as Stripe.Checkout.Session;

    // Paiement différé (virement…) : la facture attendra l'événement async_payment_succeeded
    if (session.payment_status !== "paid") {
      return Response.json({ resultat: "paiement en attente" });
    }

    const resultat = await enregistrerPaiement(supabase, session);
    return Response.json({ resultat });
  } catch (erreur) {
    console.error("Traitement du webhook Stripe impossible :", erreur);
    Sentry.captureException(erreur, { tags: { tache: "webhook-stripe" } });

    // On oublie l'événement pour que Stripe puisse le renvoyer et qu'il soit traité
    await supabase.from("evenements_stripe").delete().eq("id", evenement.id);
    return Response.json({ erreur: "Erreur temporaire." }, { status: 500 });
  }
}
