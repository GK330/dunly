import "server-only";
import Stripe from "stripe";

// Le projet fonctionne uniquement en mode test : une clé de production est refusée.
// En vraie production, l'argent doit arriver sur le compte de l'indépendant (Stripe Connect).
export function creerClientStripe(): Stripe {
  const cle = process.env.STRIPE_SECRET_KEY;

  if (!cle) {
    throw new Error("La variable STRIPE_SECRET_KEY n'est pas définie.");
  }

  if (!cle.startsWith("sk_test_") && !cle.startsWith("rk_test_")) {
    throw new Error("Seule une clé Stripe de test (sk_test_…) est acceptée par ce projet.");
  }

  return new Stripe(cle);
}

// Jeton de paiement : 64 caractères hexadécimaux, générés par la base
export const FORMAT_JETON = /^[0-9a-f]{64}$/;

export const ETATS_PAIEMENT = [
  "merci",
  "annule",
  "deja-reglee",
  "indisponible",
  "introuvable",
  "trop-de-tentatives",
  "erreur",
] as const;

export type EtatPaiement = (typeof ETATS_PAIEMENT)[number];
