import "server-only";
import { Client } from "@upstash/qstash";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

export const NOMBRE_REESSAIS = 3;

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN ?? "",
  // Une valeur vide est ignorée : la bibliothèque utilise alors l'adresse de QStash dans le cloud
  baseUrl: process.env.QSTASH_URL || undefined,
});

function verifierConfiguration(): string {
  const appUrl = process.env.APP_URL;

  if (!process.env.QSTASH_URL || !process.env.QSTASH_TOKEN) {
    throw new Error("Les variables QSTASH_URL et QSTASH_TOKEN doivent être définies.");
  }

  if (!appUrl) {
    throw new Error("La variable APP_URL n'est pas définie.");
  }

  return appUrl;
}

// Dépose dans la file un message à livrer à une route de l'application.
// Le message ne contient que des identifiants : le worker relit les données dans la base.
export async function publierTache(
  route: string,
  corps: Record<string, string>,
  options: { deduplicationId?: string } = {}
) {
  const appUrl = verifierConfiguration();

  return qstash.publishJSON({
    url: `${appUrl}${route}`,
    body: corps,
    retries: NOMBRE_REESSAIS,
    deduplicationId: options.deduplicationId,
  });
}

// Enveloppe un worker : seule une requête signée par QStash est traitée.
// La vérification est créée à la demande, pour qu'une clé absente ne casse pas
// la construction de l'application, mais refuse proprement chaque message.
export function verifierSignatureQStash(traiter: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
      console.error("Clés de signature QStash manquantes : message refusé.");
      return Response.json({ erreur: "Configuration incomplète." }, { status: 500 });
    }

    return verifySignatureAppRouter(traiter)(request);
  };
}
