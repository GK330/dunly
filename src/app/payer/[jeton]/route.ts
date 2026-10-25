import * as Sentry from "@sentry/nextjs";
import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";
import { PREFIXE_REDIS, redis } from "@/lib/limitation";
import { lireParametres } from "@/lib/parametres";
import { creerClientStripe, FORMAT_JETON, type EtatPaiement } from "@/lib/stripe";
import { creerClientAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Chaque ouverture du lien crée une session Stripe : on limite les abus (robots, rafraîchissements)
const limiteurLiens = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: `${PREFIXE_REDIS}:liens-paiement`,
});

// Lien de paiement envoyé au client dans les relances : /payer/<jeton>.
// Le jeton est aléatoire et non devinable ; ce n'est jamais l'identifiant de la facture.
export async function GET(request: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;

  function rediriger(etat: EtatPaiement) {
    return NextResponse.redirect(`${appUrl}/paiement?etat=${etat}`, 303);
  }

  if (!FORMAT_JETON.test(jeton)) {
    return rediriger("introuvable");
  }

  try {
    const quota = await limiteurLiens.limit(jeton);
    if (!quota.success) return rediriger("trop-de-tentatives");
  } catch (erreur) {
    console.error("Limitation de débit indisponible :", erreur);
  }

  // Lien public, sans session : client administrateur, strictement filtré par le jeton
  const supabase = creerClientAdmin();
  const { data } = await supabase
    .from("factures")
    .select("id, user_id, numero, montant_ttc, statut, brouillon, clients(email)")
    .eq("jeton_paiement", jeton)
    .maybeSingle();

  const facture = data as unknown as {
    id: string;
    user_id: string;
    numero: string;
    montant_ttc: number;
    statut: "en_attente" | "payee";
    brouillon: boolean;
    clients: { email: string | null } | null;
  } | null;

  if (!facture || facture.brouillon) {
    return rediriger("introuvable");
  }

  // Le clic est enregistré, mais il ne change pas le statut : sans paiement, les relances continuent
  await supabase
    .from("factures")
    .update({ lien_ouvert_le: new Date().toISOString() })
    .eq("id", facture.id);

  if (facture.statut === "payee") {
    return rediriger("deja-reglee");
  }

  const parametres = await lireParametres(supabase, facture.user_id);
  if (!parametres.paiement_carte_actif) {
    return rediriger("indisponible");
  }

  try {
    const stripe = creerClientStripe();

    // Le montant vient toujours de la base, jamais de l'adresse ni du navigateur
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(Number(facture.montant_ttc) * 100),
            product_data: {
              name: `Facture n° ${facture.numero}`,
              ...(parametres.nom_affiche && { description: `Émise par ${parametres.nom_affiche}` }),
            },
          },
        },
      ],
      customer_email: facture.clients?.email ?? undefined,
      client_reference_id: facture.id,
      metadata: { facture_id: facture.id },
      payment_intent_data: { metadata: { facture_id: facture.id } },
      success_url: `${appUrl}/paiement?etat=merci`,
      cancel_url: `${appUrl}/paiement?etat=annule`,
    });

    await supabase
      .from("factures")
      .update({ stripe_session_id: session.id })
      .eq("id", facture.id);

    if (!session.url) throw new Error("Stripe n'a pas renvoyé d'adresse de paiement.");

    return NextResponse.redirect(session.url, 303);
  } catch (erreur) {
    console.error("Création de la session de paiement impossible :", erreur);
    Sentry.captureException(erreur, {
      tags: { tache: "session-paiement" },
      extra: { factureId: facture.id },
    });
    return rediriger("erreur");
  }
}
