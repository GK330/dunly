import "server-only";
import type { Controle } from "@/lib/statut";
import { creerClientAdmin } from "@/lib/supabase/admin";

const controleVercel: Controle = {
  service: "Vercel",
  description: "Hébergement et fonctions serverless",
  verifier: async () => {
    const environnement = process.env.VERCEL_ENV ?? "local";
    const region = process.env.VERCEL_REGION ?? "poste du développeur";
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "aucun";
    return `Environnement : ${environnement} · Région : ${region} · Commit : ${commit}`;
  },
};

const controleIA: Controle = {
  service: "Modèle d'IA",
  description: "Lecture des factures, relances et réponses (API compatible OpenAI)",
  verifier: async () => {
    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;

    if (!baseUrl || !apiKey || !model) {
      throw new Error("Variables AI_BASE_URL, AI_API_KEY ou AI_MODEL manquantes");
    }

    const reponse = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!reponse.ok) {
      throw new Error(`L'API a répondu avec le statut ${reponse.status}`);
    }

    const donnees = await reponse.json();
    const modeleDisponible = donnees.data?.some(
      (m: { id: string }) => m.id === model
    );

    if (!modeleDisponible) {
      throw new Error(`Le modèle ${model} n'est pas disponible chez ce fournisseur`);
    }

    return `Modèle ${model} disponible sur ${new URL(baseUrl).host}`;
  },
};

export const controleBase: Controle = {
  service: "Supabase Database",
  description: "Base de données des clients et des factures",
  verifier: async () => {
    const supabase = creerClientAdmin();
    const { count, error } = await supabase
      .from("factures")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw new Error(error.message);
    }

    return `${count ?? 0} facture(s) enregistrée(s)`;
  },
};

const controleAuth: Controle = {
  service: "Supabase Auth",
  description: "Connexion des utilisateurs",
  verifier: async () => {
    const supabase = creerClientAdmin();
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (error) {
      throw new Error(error.message);
    }

    return "Service d'authentification joignable";
  },
};

const controleStockage: Controle = {
  service: "Supabase Storage",
  description: "Stockage des factures en PDF",
  verifier: async () => {
    const supabase = creerClientAdmin();
    const { data, error } = await supabase.storage.getBucket("factures");

    if (error || !data) {
      throw new Error(error?.message ?? "Bucket « factures » introuvable");
    }

    if (data.public) {
      throw new Error("Le bucket « factures » est public : les factures sont exposées à tous");
    }

    const limiteMo = data.file_size_limit
      ? `${Math.round(data.file_size_limit / 1024 / 1024)} Mo`
      : "aucune";

    return `Bucket « factures » privé · Taille maximale : ${limiteMo}`;
  },
};

const controleRealtime: Controle = {
  service: "Supabase Realtime",
  description: "Mise à jour des factures en temps réel",
  verifier: async () => {
    const supabase = creerClientAdmin();
    const canal = supabase.channel(`controle-${Date.now()}`);

    try {
      await new Promise<void>((resolve, reject) => {
        canal.subscribe((statut, erreur) => {
          if (statut === "SUBSCRIBED") resolve();
          if (statut === "CHANNEL_ERROR" || statut === "TIMED_OUT") {
            reject(erreur ?? new Error(`Connexion impossible (${statut})`));
          }
        });
      });

      return "Connexion WebSocket établie";
    } finally {
      await supabase.removeChannel(canal);
      supabase.realtime.disconnect();
    }
  },
};

export const CONTROLES: Controle[] = [
  controleVercel,
  controleIA,
  controleBase,
  controleAuth,
  controleStockage,
  controleRealtime,
];
