import "server-only";
import { after } from "next/server";
import { ajouterJours, aujourdhuiParis, joursEntre } from "@/lib/facture";
import { publierTache } from "@/lib/qstash";
import { niveauAPreparer, SEUILS_RELANCE } from "@/lib/relances";
import { creerClientAdmin, type ClientAdmin } from "@/lib/supabase/admin";

// Préparation des relances, de deux façons :
// - la tournée quotidienne (planification QStash) prépare les relances de demain,
//   pour prévenir l'utilisateur la veille de l'envoi ;
// - dès qu'une facture en retard est validée, sa relance est préparée tout de suite,
//   pour aujourd'hui : l'utilisateur la relit et peut l'envoyer d'un clic.
// La tournée publie aussi l'envoi des relances prévues aujourd'hui (ou avant) et autorisées.

export const ID_PLANIFICATION = "dunly-relances-quotidiennes";
export const ROUTE_TOURNEE = "/api/jobs/relances-quotidiennes";
// Tous les jours à 7 h UTC, soit 8 h ou 9 h à Paris
export const CRON_TOURNEE = "0 7 * * *";

type FactureARelancer = {
  id: string;
  user_id: string;
  echeance: string;
  relances_en_pause_jusqu_au: string | null;
  clients: { email: string | null } | null;
};

type RelanceExistante = {
  facture_id: string;
  niveau: number;
  statut: string;
  envoyee_le: string | null;
};

export async function preparerRelances(
  supabase: ClientAdmin,
  aujourdhui: string,
  options: { factureId?: string; immediat?: boolean } = {}
) {
  const jourEnvoi = options.immediat ? aujourdhui : ajouterJours(aujourdhui, 1);
  // Au moins trois jours de retard le jour de l'envoi
  const echeanceMax = ajouterJours(jourEnvoi, -SEUILS_RELANCE[1]);

  let requete = supabase
    .from("factures")
    .select("id, user_id, echeance, relances_en_pause_jusqu_au, clients(email)")
    .eq("statut", "en_attente")
    .eq("brouillon", false)
    .eq("relances_arretees", false)
    .lte("echeance", echeanceMax);

  if (options.factureId) {
    requete = requete.eq("id", options.factureId);
  }

  const { data, error } = await requete;
  if (error) throw error;

  const factures = (data ?? []) as unknown as FactureARelancer[];
  if (factures.length === 0) return { creees: 0 };

  const { data: existantes, error: erreurRelances } = await supabase
    .from("relances")
    .select("facture_id, niveau, statut, envoyee_le")
    .in("facture_id", factures.map((f) => f.id))
    .neq("statut", "annulee");

  if (erreurRelances) throw erreurRelances;

  let creees = 0;

  for (const facture of factures) {
    // En pause jusqu'au (inclus) : la relance attendra
    if (facture.relances_en_pause_jusqu_au && facture.relances_en_pause_jusqu_au >= jourEnvoi) continue;

    // Sans adresse e-mail, impossible de relancer ce client
    if (!facture.clients?.email) continue;

    const relancesFacture = ((existantes ?? []) as RelanceExistante[]).filter(
      (r) => r.facture_id === facture.id
    );

    // Une seule relance en cours par facture
    if (relancesFacture.some((r) => r.statut === "brouillon" || r.statut === "validee")) continue;

    const envoyees = relancesFacture.filter((r) => r.statut === "envoyee");
    const dernierNiveau = Math.max(0, ...envoyees.map((r) => r.niveau));
    const dernierEnvoi = envoyees
      .map((r) => r.envoyee_le?.slice(0, 10))
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1);

    const niveau = niveauAPreparer(
      joursEntre(facture.echeance, jourEnvoi),
      dernierNiveau,
      dernierEnvoi ? joursEntre(dernierEnvoi, jourEnvoi) : null
    );
    if (niveau === 0) continue;

    const { data: relance, error: erreurInsertion } = await supabase
      .from("relances")
      .insert({
        user_id: facture.user_id,
        facture_id: facture.id,
        niveau,
        prevue_le: jourEnvoi,
        statut: "brouillon",
      })
      .select("id")
      .single();

    // Idempotence : si la préparation tourne deux fois, l'index unique refuse le doublon
    if (erreurInsertion) {
      if (erreurInsertion.code !== "23505") {
        console.error("Création de relance impossible :", erreurInsertion);
      }
      continue;
    }

    await publierTache(
      "/api/jobs/generer-relance",
      { relanceId: relance.id },
      { deduplicationId: `generer-${relance.id}` }
    );
    creees++;
  }

  return { creees };
}

// Prépare tout de suite la relance d'une facture qui vient d'être validée en retard,
// après la réponse : l'utilisateur n'attend pas. Sans effet si la facture n'est pas en retard.
// Un échec est journalisé, la tournée du lendemain prendra le relais.
export function preparerRelanceImmediate(factureId: string) {
  after(async () => {
    try {
      await preparerRelances(creerClientAdmin(), aujourdhuiParis(), { factureId, immediat: true });
    } catch (erreur) {
      console.error("Préparation immédiate de la relance impossible :", erreur);
    }
  });
}

export async function publierEnvois(supabase: ClientAdmin, aujourdhui: string) {
  const { data, error } = await supabase
    .from("relances")
    .select("id, user_id, statut")
    .in("statut", ["brouillon", "validee"])
    .lte("prevue_le", aujourdhui)
    .not("contenu", "is", null);

  if (error) throw error;

  const relances = data ?? [];
  const utilisateurs = [...new Set(relances.filter((r) => r.statut === "brouillon").map((r) => r.user_id))];

  // Les brouillons ne partent que si l'utilisateur a désactivé la validation des relances
  const sansValidation = new Set<string>();
  if (utilisateurs.length > 0) {
    const { data: parametres } = await supabase
      .from("parametres")
      .select("user_id, validation_relances")
      .in("user_id", utilisateurs);

    for (const p of parametres ?? []) {
      if (p.validation_relances === false) sansValidation.add(p.user_id);
    }
  }

  let publiees = 0;
  for (const relance of relances) {
    if (relance.statut === "brouillon" && !sansValidation.has(relance.user_id)) continue;

    await publierTache(
      "/api/jobs/envoyer-relance",
      { relanceId: relance.id },
      { deduplicationId: `envoyer-${relance.id}-${aujourdhui}` }
    );
    publiees++;
  }

  return { publiees };
}
