import Link from "next/link";
import ActualisationTempsReel from "@/components/ActualisationTempsReel";
import BadgeAnalyse from "@/components/BadgeAnalyse";
import BadgeStatut from "@/components/BadgeStatut";
import ImportFacturePdf from "@/components/ImportFacturePdf";
import {
  aujourdhuiParis,
  COLONNES_FACTURE,
  formaterDate,
  formaterMontant,
  LIBELLES_STATUT,
  statutAffiche,
  type Facture,
  type StatutAffiche,
} from "@/lib/facture";
import { creerClientServeur } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FactureAvecClient = Facture & {
  clients: { nom: string } | null;
  client_detecte: string | null;
};

const FILTRES: StatutAffiche[] = ["en_retard", "en_attente", "payee", "brouillon"];

export default async function ListeFactures({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { filtre } = await searchParams;
  const filtreActif = FILTRES.find((f) => f === filtre);

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("factures")
    .select(`${COLONNES_FACTURE}, clients(nom), client_detecte:donnees_extraites->>client_nom`)
    .order("created_at", { ascending: false });

  const aujourdhui = aujourdhuiParis();
  const factures = ((data ?? []) as unknown as FactureAvecClient[])
    .map((facture) => ({ ...facture, affiche: statutAffiche(facture, aujourdhui) }))
    .filter((facture) => !filtreActif || facture.affiche === filtreActif);

  return (
    <main className="mx-auto max-w-5xl p-8">
      {user && <ActualisationTempsReel userId={user.id} tables={["factures"]} />}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Factures</h1>
        <Link href="/factures/nouvelle" className="rounded border px-4 py-2">
          Saisir une facture à la main
        </Link>
      </div>

      <div className="mt-6 max-w-xl">
        <ImportFacturePdf />
      </div>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/factures"
          className={`rounded px-3 py-1 ${!filtreActif ? "bg-blue-600 text-white" : "border"}`}
        >
          Toutes
        </Link>
        {FILTRES.map((f) => (
          <Link
            key={f}
            href={`/factures?filtre=${f}`}
            className={`rounded px-3 py-1 ${filtreActif === f ? "bg-blue-600 text-white" : "border"}`}
          >
            {LIBELLES_STATUT[f].libelle}
          </Link>
        ))}
      </nav>

      {error && <p className="mt-6 text-red-700">Impossible de charger les factures.</p>}

      {!error && factures.length === 0 && (
        <p className="mt-6 text-gray-600">Aucune facture pour l’instant.</p>
      )}

      {factures.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Numéro</th>
                <th className="p-2">Client</th>
                <th className="p-2 text-right">Montant TTC</th>
                <th className="p-2">Échéance</th>
                <th className="p-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {factures.map((facture) => (
                <tr key={facture.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <Link href={`/factures/${facture.id}`} className="font-medium text-blue-600 underline">
                      {facture.numero ?? "Sans numéro"}
                    </Link>
                  </td>
                  <td className="p-2">
                    {facture.clients?.nom ??
                      (facture.client_detecte ? (
                        <span className="italic text-gray-500">
                          {facture.client_detecte} (à créer)
                        </span>
                      ) : (
                        "—"
                      ))}
                  </td>
                  <td className="p-2 text-right">{formaterMontant(facture.montant_ttc)}</td>
                  <td className="p-2">{formaterDate(facture.echeance)}</td>
                  <td className="p-2">
                    {facture.etat_analyse === "en_cours" || facture.etat_analyse === "erreur" ? (
                      <BadgeAnalyse analyse={facture.etat_analyse} />
                    ) : (
                      <BadgeStatut statut={facture.affiche} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
