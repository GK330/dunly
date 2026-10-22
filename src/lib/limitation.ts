import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lit UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN
export const redis = Redis.fromEnv();

// Toutes les clés de l'application commencent par ce préfixe
export const PREFIXE_REDIS = "encaisse";

// Chaque appel au modèle d'IA consomme le quota partagé du fournisseur :
// chaque utilisateur dispose de sa propre part, sur une fenêtre glissante d'une heure
export const QUOTA_ANALYSES = 10;

export const limiteurAnalyses = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(QUOTA_ANALYSES, "1 h"),
  prefix: `${PREFIXE_REDIS}:analyses`,
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
