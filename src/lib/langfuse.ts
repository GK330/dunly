import "server-only";
import { after } from "next/server";

export type ContexteTrace = {
  id: string;
  nom: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

type Generation = {
  trace: ContexteTrace;
  modele: string;
  entree: unknown;
  sortie?: unknown;
  debut: Date;
  fin: Date;
  tokensEntree?: number;
  tokensSortie?: number;
  erreur?: string;
};

export function tracerGeneration(generation: Generation) {
  const baseUrl = process.env.LANGFUSE_BASE_URL;
  const clePublique = process.env.LANGFUSE_PUBLIC_KEY;
  const cleSecrete = process.env.LANGFUSE_SECRET_KEY;

  // L'observabilité est facultative : sans configuration, l'application fonctionne normalement
  if (!baseUrl || !clePublique || !cleSecrete) return;

  const maintenant = new Date().toISOString();
  const environnement = process.env.VERCEL_ENV ?? "local";

  // Coût de l'appel, si le prix du modèle est configuré (en dollars par million de tokens)
  const prixEntree = Number(process.env.AI_PRIX_ENTREE_PAR_MILLION);
  const prixSortie = Number(process.env.AI_PRIX_SORTIE_PAR_MILLION);
  const coutCalculable =
    generation.tokensEntree !== undefined &&
    Boolean(process.env.AI_PRIX_ENTREE_PAR_MILLION) &&
    Boolean(process.env.AI_PRIX_SORTIE_PAR_MILLION) &&
    Number.isFinite(prixEntree) &&
    Number.isFinite(prixSortie);

  const coutEntree = coutCalculable ? (generation.tokensEntree! * prixEntree) / 1_000_000 : 0;
  const coutSortie = coutCalculable ? ((generation.tokensSortie ?? 0) * prixSortie) / 1_000_000 : 0;

  const lot = [
    {
      id: crypto.randomUUID(),
      timestamp: maintenant,
      type: "trace-create",
      body: {
        id: generation.trace.id,
        name: generation.trace.nom,
        userId: generation.trace.userId,
        metadata: generation.trace.metadata,
        tags: [environnement],
      },
    },
    {
      id: crypto.randomUUID(),
      timestamp: maintenant,
      type: "generation-create",
      body: {
        id: crypto.randomUUID(),
        traceId: generation.trace.id,
        name: "appel-modele",
        model: generation.modele,
        input: generation.entree,
        output: generation.sortie,
        startTime: generation.debut.toISOString(),
        endTime: generation.fin.toISOString(),
        usageDetails:
          generation.tokensEntree !== undefined
            ? { input: generation.tokensEntree, output: generation.tokensSortie ?? 0 }
            : undefined,
        costDetails: coutCalculable
          ? { input: coutEntree, output: coutSortie, total: coutEntree + coutSortie }
          : undefined,
        level: generation.erreur ? "ERROR" : "DEFAULT",
        statusMessage: generation.erreur,
      },
    },
  ];

  // Envoi après la réponse : l'observabilité ne doit jamais ralentir le traitement
  after(async () => {
    try {
      const authentification = Buffer.from(`${clePublique}:${cleSecrete}`).toString("base64");
      const reponse = await fetch(`${baseUrl}/api/public/ingestion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authentification}`,
        },
        body: JSON.stringify({ batch: lot }),
      });

      if (!reponse.ok) {
        console.error(`Langfuse a refusé les traces (${reponse.status}) :`, await reponse.text());
      }
    } catch (erreur) {
      // Un échec d'envoi est journalisé, mais ne fait jamais échouer le traitement
      console.error("Envoi des traces vers Langfuse impossible :", erreur);
    }
  });
}
