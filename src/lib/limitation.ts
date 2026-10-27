import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lit UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN
export const redis = Redis.fromEnv();

export const PREFIXE_REDIS = "dunly";

// Chaque appel au modèle d'IA consomme le quota partagé du fournisseur :
// chaque utilisateur dispose de sa propre part, sur une fenêtre glissante.
export const QUOTA_ANALYSES = 2;
export const QUOTA_RELANCES = 30;
export const QUOTA_CLASSIFICATIONS = 50;

export const limiteurAnalyses = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(QUOTA_ANALYSES, "1 h"),
  prefix: `${PREFIXE_REDIS}:analyses`,
});

export const limiteurRelances = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(QUOTA_RELANCES, "1 d"),
  prefix: `${PREFIXE_REDIS}:relances`,
});

export const limiteurClassifications = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(QUOTA_CLASSIFICATIONS, "1 d"),
  prefix: `${PREFIXE_REDIS}:classifications`,
});

// Chaque ouverture d'un lien de paiement crée une session Stripe : on limite les abus
export const limiteurLiensPaiement = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: `${PREFIXE_REDIS}:liens-paiement`,
});

export type ResultatQuota = {
  autorise: boolean;
  limite: number | null;
  restant: number | null;
  secondesAvantReinitialisation: number;
};

// Si Redis est en panne, on laisse passer (fail open) en journalisant l'incident :
// pour cette application, la disponibilité prime sur la protection du quota
export async function verifierQuota(limiteur: Ratelimit, identifiant: string): Promise<ResultatQuota> {
  try {
    const quota = await limiteur.limit(identifiant);
    return {
      autorise: quota.success,
      limite: quota.limit,
      restant: quota.remaining,
      secondesAvantReinitialisation: Math.max(1, Math.ceil((quota.reset - Date.now()) / 1000)),
    };
  } catch (erreur) {
    console.error("Limitation de débit indisponible :", erreur);
    return { autorise: true, limite: null, restant: null, secondesAvantReinitialisation: 0 };
  }
}

export function entetesQuota(quota: ResultatQuota): Record<string, string> {
  if (quota.limite === null || quota.restant === null) return {};
  return {
    "X-RateLimit-Limit": String(quota.limite),
    "X-RateLimit-Remaining": String(quota.restant),
  };
}
