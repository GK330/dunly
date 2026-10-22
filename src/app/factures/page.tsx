import Link from "next/link";
import ActualisationTempsReel from "@/components/ActualisationTempsReel";
import BadgeAnalyse from "@/components/BadgeAnalyse";
import BadgeStatut from "@/components/BadgeStatut";
import ImportFacturePdf from "@/components/ImportFacturePdf";
import { LectureIALigne } from "@/components/LectureIA";
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
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      {user && <ActualisationTempsReel userId={user.id} tables={["factures"]} />}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="titre-page">Factures</h1>
        <Link href="/factures/nouvelle" className="btn btn-secondaire">
          Saisir une facture à la main
        </Link>
      </div>

      <div className="mt-6 max-w-xl">
        <ImportFacturePdf />
      </div>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/factures"
          className={`rounded-full px-3 py-1 ${!filtreActif ? "onglet-actif text-white" : "border border-grege bg-white hover:bg-abricot/50"}`}
        >
          Toutes
        </Link>
        {FILTRES.map((f) => (
          <Link
            key={f}
            href={`/factures?filtre=${f}`}
            className={`rounded-full px-3 py-1 ${filtreActif === f ? "onglet-actif text-white" : "border border-grege bg-white hover:bg-abricot/50"}`}
          >
            {LIBELLES_STATUT[f].libelle}
          </Link>
        ))}
      </nav>

      {error && <p className="mt-6 text-red-700">Impossible de charger les factures.</p>}

      {!error && factures.length === 0 && (
        <p className="mt-6 text-stone-600">Aucune facture pour l’instant.</p>
      )}

      {factures.length > 0 && (
        <div className="carte mt-6 overflow-x-auto p-2">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-grege text-xs tracking-wide text-brun uppercase">
                <th className="px-3 py-2.5">Numéro</th>
                <th className="px-3 py-2.5">Client</th>
                <th className="px-3 py-2.5 text-right">Montant TTC</th>
                <th className="px-3 py-2.5">Échéance</th>
                <th className="px-3 py-2.5">Statut</th>
              </tr>
            </thead>
            <tbody>
              {factures.map((facture) => (
                <tr key={facture.id} className="border-b border-grege/70 last:border-0 hover:bg-abricot/30">
                  <td className="px-3 py-2.5">
                    <Link href={`/factures/${facture.id}`} className="lien font-mono whitespace-nowrap">
                      {facture.numero ?? "Sans numéro"}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    {facture.clients?.nom ??
                      (facture.client_detecte ? (
                        <span className="italic text-stone-500">
                          {facture.client_detecte} (à créer)
                        </span>
                      ) : (
                        "—"
                      ))}
                  </td>
                  <td className="px-3 py-2.5 text-right">{formaterMontant(facture.montant_ttc)}</td>
                  <td className="px-3 py-2.5">{formaterDate(facture.echeance)}</td>
                  <td className="px-3 py-2.5">
                    {facture.etat_analyse === "en_cours" ? (
                      <LectureIALigne />
                    ) : facture.etat_analyse === "erreur" ? (
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
