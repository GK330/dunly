import Link from "next/link";
import { notFound } from "next/navigation";
import BadgeStatut from "@/components/BadgeStatut";
import BoutonAction from "@/components/BoutonAction";
import FormulaireClient from "@/components/FormulaireClient";
import {
  aujourdhuiParis,
  COLONNES_FACTURE,
  formaterDate,
  formaterMontant,
  statutAffiche,
  type Client,
  type Facture,
} from "@/lib/facture";
import { scoreDeRisque, type StatistiquesClient } from "@/lib/relances";
import { creerClientServeur } from "@/lib/supabase/server";
import { estUuid } from "@/lib/validation";

export default async function DetailClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) notFound();

  const supabase = await creerClientServeur();
  const { data: client } = await supabase
    .from("clients")
    .select("id, nom, email, created_at")
    .eq("id", id)
    .maybeSingle<Client>();

  if (!client) {
    notFound();
  }

  const [{ data }, { data: statistiques }] = await Promise.all([
    supabase
      .from("factures")
      .select(COLONNES_FACTURE)
      .eq("client_id", id)
      .order("emise_le", { ascending: false }),
    // Historique calculé en SQL par la vue statistiques_clients
    supabase
      .from("statistiques_clients")
      .select("nombre_factures, nombre_retards, retard_moyen_jours")
      .eq("client_id", id)
      .maybeSingle<StatistiquesClient>(),
  ]);

  const risque = statistiques ? scoreDeRisque(statistiques) : null;

  const factures = (data ?? []) as Facture[];
  const aujourdhui = aujourdhuiParis();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/clients" className="lien">
        ← Retour aux clients
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="titre-page">{client.nom}</h1>
        {risque && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${risque.classes}`}>
            {risque.libelle}
          </span>
        )}
      </div>

      {statistiques && (
        <dl className="carte mt-4 grid max-w-xl grid-cols-3 gap-3 p-5 text-sm">
          <div>
            <dt className="text-stone-500">Factures</dt>
            <dd className="font-titre text-xl font-semibold">{statistiques.nombre_factures}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Retards</dt>
            <dd className="font-titre text-xl font-semibold">{statistiques.nombre_retards}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Retard moyen</dt>
            <dd className="font-titre text-xl font-semibold">{statistiques.retard_moyen_jours} j</dd>
          </div>
        </dl>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_320px]">
        <section>
          <h2 className="font-titre text-lg font-semibold">Factures</h2>
          {factures.length === 0 && (
            <p className="mt-2 text-stone-600">Aucune facture pour ce client.</p>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {factures.map((facture) => (
              <li key={facture.id}>
                <Link
                  href={`/factures/${facture.id}`}
                  className="carte carte-lien flex items-center justify-between p-4"
                >
                  <span>
                    <span className="font-medium">N° {facture.numero ?? "—"}</span>{" "}
                    <span className="text-sm text-stone-500">
                      · échéance {formaterDate(facture.echeance)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {formaterMontant(facture.montant_ttc)}
                    <BadgeStatut statut={statutAffiche(facture, aujourdhui)} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex flex-col gap-4">
          <FormulaireClient client={client} />
          <BoutonAction
            url={`/api/clients/${client.id}`}
            methode="DELETE"
            libelle="Supprimer ce client"
            libelleEnCours="Suppression…"
            confirmation={`Le client « ${client.nom} » sera supprimé définitivement.`}
            succes="Client supprimé."
            redirection="/clients"
            variante="danger"
          />
        </aside>
      </div>
    </main>
  );
}
