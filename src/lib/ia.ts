import "server-only";
import { tracerGeneration, type ContexteTrace } from "@/lib/langfuse";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type SchemaJSON = {
  nom: string;
  schema: Record<string, unknown>;
};

export class ErreurIA extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function appelerModele(
  messages: Message[],
  options: { schema?: SchemaJSON; trace?: ContexteTrace; temperature?: number } = {}
): Promise<string> {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new ErreurIA("La configuration du modèle d'IA est incomplète.", 500);
  }

  const debut = new Date();

  // Transmet l'appel à Langfuse, s'il fait partie d'une trace
  function tracer(details: {
    sortie?: unknown;
    tokensEntree?: number;
    tokensSortie?: number;
    erreur?: string;
  }) {
    if (!options.trace) return;
    tracerGeneration({
      trace: options.trace,
      modele: model!,
      entree: messages,
      debut,
      fin: new Date(),
      ...details,
    });
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        ...(options.schema && {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: options.schema.nom,
              strict: true,
              schema: options.schema.schema,
            },
          },
        }),
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (erreur) {
    tracer({ erreur: erreur instanceof Error ? erreur.message : "Erreur réseau" });
    throw erreur;
  }

  if (!reponse.ok) {
    const detail = await reponse.text();
    console.error(`Erreur du modèle d'IA (${reponse.status}) : ${detail}`);
    tracer({ erreur: `Statut ${reponse.status} : ${detail}` });
    throw new ErreurIA("Le modèle d'IA a renvoyé une erreur.", reponse.status);
  }

  const donnees = await reponse.json();
  const contenu: string = donnees.choices?.[0]?.message?.content ?? "";

  tracer({
    sortie: contenu,
    tokensEntree: donnees.usage?.prompt_tokens,
    tokensSortie: donnees.usage?.completion_tokens,
  });

  return contenu;
}

// Lit la réponse JSON du modèle : une réponse illisible est une erreur de format
export function lireJSON(contenu: string): unknown {
  try {
    return JSON.parse(contenu);
  } catch {
    throw new ErreurIA("La réponse du modèle n'est pas un JSON valide.", 502);
  }
}

// Seules les erreurs de format justifient une nouvelle tentative immédiate :
// une erreur de quota ou de configuration se reproduirait à l'identique
export function estErreurDeFormat(erreur: unknown): boolean {
  return erreur instanceof ErreurIA && (erreur.status === 400 || erreur.status === 502);
}

// Erreur passagère : QStash peut réessayer plus tard
export function estReessayable(erreur: unknown): boolean {
  if (erreur instanceof ErreurIA) {
    return erreur.status === 429 || erreur.status >= 500;
  }
  // Délai dépassé, panne réseau ou erreur inattendue : une nouvelle tentative peut réussir
  return true;
}

export function messageErreurIA(erreur: unknown): string {
  if (erreur instanceof ErreurIA && erreur.status === 429) {
    return "Le service d'IA est momentanément saturé.";
  }

  if (erreur instanceof ErreurIA && erreur.status === 413) {
    return "Le texte est trop volumineux pour le service d'IA.";
  }

  if (erreur instanceof Error && erreur.name === "TimeoutError") {
    return "Le service d'IA a mis trop de temps à répondre.";
  }

  return "Le traitement par l'IA a échoué.";
}
