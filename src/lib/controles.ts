import "server-only";
import { lireRedirection } from "@/lib/email";
import { QUOTA_ANALYSES, redis } from "@/lib/limitation";
import { qstash } from "@/lib/qstash";
import type { Controle } from "@/lib/statut";
import { creerClientStripe } from "@/lib/stripe";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { ID_PLANIFICATION, ROUTE_TOURNEE } from "@/lib/tournee-relances";

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

const controleRedis: Controle = {
  service: "Upstash Redis",
  description: "Quotas par utilisateur",
  verifier: async () => {
    const reponse = await redis.ping();

    if (reponse !== "PONG") {
      throw new Error(`Réponse inattendue : ${reponse}`);
    }

    const nombreCles = await redis.dbsize();
    return `Base joignable · ${nombreCles} clé(s) · Quota : ${QUOTA_ANALYSES} lectures de PDF par heure et par utilisateur`;
  },
};

const controleQStash: Controle = {
  service: "Upstash QStash",
  description: "File de messages des traitements en arrière-plan",
  verifier: async () => {
    if (!process.env.QSTASH_URL || !process.env.QSTASH_TOKEN) {
      throw new Error("Variables QSTASH_URL ou QSTASH_TOKEN manquantes");
    }

    if (!process.env.APP_URL) {
      throw new Error("Variable APP_URL manquante : QStash ne saurait pas où livrer les messages");
    }

    if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
      throw new Error("Clés de signature manquantes : les workers refuseraient tous les messages");
    }

    await qstash.schedules.list();

    return `Service joignable · Destination : ${process.env.APP_URL}`;
  },
};

const controleTournee: Controle = {
  service: "Tournée des relances",
  description: "Planification quotidienne QStash des relances",
  verifier: async () => {
    const destination = `${process.env.APP_URL}${ROUTE_TOURNEE}`;

    let planification;
    try {
      planification = await qstash.schedules.get(ID_PLANIFICATION);
    } catch {
      throw new Error("Aucune planification : cliquez sur « Planifier la tournée quotidienne »");
    }

    if (planification.destination !== destination) {
      throw new Error(`La planification livre ${planification.destination} au lieu de ${destination}`);
    }

    if (planification.isPaused) {
      throw new Error("La planification est en pause : aucune relance ne sera préparée");
    }

    const { count } = await creerClientAdmin()
      .from("relances")
      .select("id", { count: "exact", head: true })
      .eq("statut", "brouillon");

    return `Cron « ${planification.cron} » (UTC) · ${count ?? 0} relance(s) en attente de validation`;
  },
};

const controleStripe: Controle = {
  service: "Stripe",
  description: "Paiement des factures par carte (mode test)",
  verifier: async () => {
    // Refuse d'elle-même toute clé qui ne serait pas une clé de test
    const stripe = creerClientStripe();

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Variable STRIPE_WEBHOOK_SECRET manquante : aucun paiement ne serait enregistré");
    }

    const solde = await stripe.balance.retrieve();
    if (solde.livemode) {
      throw new Error("Clé de production détectée : ce projet doit rester en mode test");
    }

    const attendu = `${process.env.APP_URL}/api/webhooks/stripe`;
    const { data: points } = await stripe.webhookEndpoints.list({ limit: 20 });
    const webhook = points.find((p) => p.url === attendu);

    if (!webhook) {
      // En local, Stripe ne peut pas joindre localhost : la CLI relaie les événements
      if (!process.env.VERCEL_ENV) return "Mode test · Webhook local relayé par la CLI Stripe (stripe listen)";
      throw new Error(`Aucun webhook Stripe ne pointe vers ${attendu}`);
    }

    if (webhook.status !== "enabled") {
      throw new Error("Le webhook Stripe est désactivé");
    }

    const evenements = webhook.enabled_events;
    if (!evenements.includes("*") && !evenements.includes("checkout.session.completed")) {
      throw new Error("Le webhook Stripe n'écoute pas l'événement checkout.session.completed");
    }

    return `Mode test · Webhook actif vers ${attendu}`;
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

const controleEmail: Controle = {
  service: "Resend",
  description: "Envoi des relances et des notifications",
  verifier: async () => {
    const cle = process.env.RESEND_API_KEY;
    if (!cle) {
      throw new Error("Variable RESEND_API_KEY manquante");
    }

    const redirection = lireRedirection();
    if (redirection.bloque) {
      throw new Error("Garde-fou : EMAIL_REDIRECTION manquante hors production, tous les envois sont bloqués");
    }

    const garde = redirection.active
      ? `Garde-fou actif : envois redirigés vers ${redirection.adresse}`
      : "Envois réels aux destinataires";

    const reponse = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${cle}` },
      cache: "no-store",
    });

    if (reponse.ok) {
      return `Clé valide (accès complet) · ${garde}`;
    }

    const corps = await reponse.json().catch(() => ({}));

    // Une clé limitée à l'envoi est reconnue par Resend, mais refusée sur cette route :
    // c'est la preuve qu'elle est valide, avec le minimum de droits
    if (corps.name === "restricted_api_key") {
      return `Clé valide, limitée à l'envoi · ${garde}`;
    }

    throw new Error(corps.message ?? `L'API a répondu avec le statut ${reponse.status}`);
  },
};

const controleSentry: Controle = {
  service: "Sentry",
  description: "Suivi des erreurs",
  verifier: async () => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) {
      throw new Error("Variable NEXT_PUBLIC_SENTRY_DSN manquante : les erreurs ne sont pas collectées");
    }

    const adresse = new URL(dsn);
    const environnement = process.env.VERCEL_ENV ?? "local";

    return `DSN configuré · Envoi vers ${adresse.host} · Environnement : ${environnement}`;
  },
};

const STATUTS_UPTIMEROBOT: Record<number, string> = {
  0: "en pause",
  1: "pas encore vérifié",
  2: "opérationnel",
  8: "probablement en panne",
  9: "en panne",
};

const controleUptimeRobot: Controle = {
  service: "UptimeRobot",
  description: "Surveillance externe de disponibilité",
  verifier: async () => {
    const cle = process.env.UPTIMEROBOT_API_KEY;
    if (!cle) {
      throw new Error("Variable UPTIMEROBOT_API_KEY manquante");
    }

    const reponse = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_key: cle,
        format: "json",
        custom_uptime_ratios: "30",
      }),
      cache: "no-store",
    });

    const donnees = await reponse.json();

    if (donnees.stat !== "ok") {
      throw new Error(donnees.error?.message ?? "Réponse inattendue de l'API UptimeRobot");
    }

    const moniteur = donnees.monitors?.[0];
    if (!moniteur) {
      throw new Error("Aucun moniteur configuré");
    }

    const etat = STATUTS_UPTIMEROBOT[moniteur.status] ?? "statut inconnu";
    if (moniteur.status === 8 || moniteur.status === 9) {
      throw new Error(`Le moniteur « ${moniteur.friendly_name} » signale une panne`);
    }

    return `Moniteur ${etat} · Disponibilité sur 30 jours : ${moniteur.custom_uptime_ratio} %`;
  },
};

const controleLangfuse: Controle = {
  service: "Langfuse",
  description: "Observabilité des appels au modèle d'IA",
  verifier: async () => {
    const baseUrl = process.env.LANGFUSE_BASE_URL;
    const clePublique = process.env.LANGFUSE_PUBLIC_KEY;
    const cleSecrete = process.env.LANGFUSE_SECRET_KEY;

    if (!baseUrl || !clePublique || !cleSecrete) {
      throw new Error("Variables Langfuse manquantes : les appels au modèle ne sont pas tracés");
    }

    const sante = await fetch(`${baseUrl}/api/public/health`, { cache: "no-store" });
    if (!sante.ok) {
      throw new Error(`Le service a répondu avec le statut ${sante.status}`);
    }

    const authentification = Buffer.from(`${clePublique}:${cleSecrete}`).toString("base64");
    const projets = await fetch(`${baseUrl}/api/public/projects`, {
      headers: { Authorization: `Basic ${authentification}` },
      cache: "no-store",
    });

    if (!projets.ok) {
      throw new Error(`Clés refusées (statut ${projets.status})`);
    }

    const donnees = await projets.json();
    const nomProjet = donnees.data?.[0]?.name ?? "inconnu";

    return `Service joignable · Projet « ${nomProjet} »`;
  },
};

export const VARIABLES_REQUISES = [
  "AI_BASE_URL",
  "AI_API_KEY",
  "AI_MODEL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "ADMIN_EMAILS",
  "APP_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "QSTASH_URL",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "RESEND_API_KEY",
  "EMAIL_EXPEDITEUR",
  "NEXT_PUBLIC_SENTRY_DSN",
  "UPTIMEROBOT_API_KEY",
  "LANGFUSE_BASE_URL",
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "JETON_API_VERCEL",
  "PROJET_VERCEL_ID",
  "EQUIPE_VERCEL_ID",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

const controleSecrets: Controle = {
  service: "Infisical",
  description: "Gestion centralisée des secrets",
  verifier: async () => {
    const manquantes = VARIABLES_REQUISES.filter((nom) => !process.env[nom]);

    if (manquantes.length > 0) {
      throw new Error(`Variables manquantes : ${manquantes.join(", ")}`);
    }

    const reponse = await fetch("https://eu.infisical.com/api/status", { cache: "no-store" });
    if (!reponse.ok) {
      throw new Error(`Le service a répondu avec le statut ${reponse.status}`);
    }

    return `Service joignable · ${VARIABLES_REQUISES.length} variables configurées`;
  },
};

const controleDeploiement: Controle = {
  service: "Déploiement continu",
  description: "Dernier déploiement de production sur Vercel",
  verifier: async () => {
    const jeton = process.env.JETON_API_VERCEL;
    const projet = process.env.PROJET_VERCEL_ID;
    const equipe = process.env.EQUIPE_VERCEL_ID;

    if (!jeton || !projet || !equipe) {
      throw new Error("Variables JETON_API_VERCEL, PROJET_VERCEL_ID ou EQUIPE_VERCEL_ID manquantes");
    }

    const parametres = new URLSearchParams({
      projectId: projet,
      teamId: equipe,
      target: "production",
      limit: "1",
    });

    const reponse = await fetch(`https://api.vercel.com/v6/deployments?${parametres}`, {
      headers: { Authorization: `Bearer ${jeton}` },
      cache: "no-store",
    });

    if (!reponse.ok) {
      throw new Error(`L'API Vercel a répondu avec le statut ${reponse.status}`);
    }

    const { deployments } = await reponse.json();
    const dernier = deployments?.[0];

    if (!dernier) {
      throw new Error("Aucun déploiement de production trouvé");
    }

    const etat: string = dernier.state ?? dernier.readyState;
    const commitDernier: string = dernier.meta?.githubCommitSha?.slice(0, 7) ?? "inconnu";
    const commitEnLigne = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

    if (etat === "ERROR") {
      throw new Error(
        `La dernière construction de production a échoué (commit ${commitDernier}) : la version précédente est toujours en ligne`
      );
    }

    if (etat === "BUILDING" || etat === "QUEUED" || etat === "INITIALIZING") {
      return `Construction de production en cours (commit ${commitDernier})`;
    }

    if (commitEnLigne && commitEnLigne !== commitDernier) {
      return `Version ${commitDernier} prête, en attente de mise en production · En ligne : ${commitEnLigne}`;
    }

    return `Dernier déploiement réussi et en ligne (commit ${commitDernier})`;
  },
};

export const CONTROLES: Controle[] = [
  controleVercel,
  controleIA,
  controleBase,
  controleAuth,
  controleStockage,
  controleRedis,
  controleQStash,
  controleTournee,
  controleRealtime,
  controleEmail,
  controleStripe,
  controleSentry,
  controleUptimeRobot,
  controleLangfuse,
  controleSecrets,
  controleDeploiement,
];
