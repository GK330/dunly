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

  const { data } = await supabase
    .from("factures")
    .select(COLONNES_FACTURE)
    .eq("client_id", id)
    .order("emise_le", { ascending: false });

  const factures = (data ?? []) as Facture[];
  const aujourdhui = aujourdhuiParis();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/clients" className="lien">
        ← Retour aux clients
      </Link>
      <h1 className="titre-page mt-4">{client.nom}</h1>

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
            confirmation={`Supprimer définitivement le client « ${client.nom} » ?`}
            redirection="/clients"
            variante="danger"
          />
        </aside>
      </div>
    </main>
  );
}
