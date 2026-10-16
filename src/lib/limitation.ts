import "server-only";
import { Redis } from "@upstash/redis";

// Lit UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN
export const redis = Redis.fromEnv();

// Toutes les clés de l'application commencent par ce préfixe
export const PREFIXE_REDIS = "encaisse";
