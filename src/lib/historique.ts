import "server-only";
import { PREFIXE_REDIS, redis } from "@/lib/limitation";
import type { EntreeHistorique, ResultatControle, Statut } from "@/lib/statut";

const CLE = `${PREFIXE_REDIS}:admin:historique`;
const TAILLE_MAX = 50;

export async function enregistrerControle(statutGlobal: Statut, services: ResultatControle[]) {
  const entree: EntreeHistorique = {
    date: new Date().toISOString(),
    statutGlobal,
    servicesEnPanne: services.filter((s) => s.statut === "en_panne").map((s) => s.service),
    servicesDegrades: services.filter((s) => s.statut === "degrade").map((s) => s.service),
  };

  try {
    await redis.lpush(CLE, entree);
    await redis.ltrim(CLE, 0, TAILLE_MAX - 1);
  } catch (erreur) {
    // L'historique est un confort : son indisponibilité ne doit pas empêcher les contrôles
    console.error("Impossible d'enregistrer l'historique des contrôles :", erreur);
  }
}

export async function lireHistorique(nombre = 20): Promise<EntreeHistorique[]> {
  try {
    return await redis.lrange<EntreeHistorique>(CLE, 0, nombre - 1);
  } catch (erreur) {
    console.error("Impossible de lire l'historique des contrôles :", erreur);
    return [];
  }
}
