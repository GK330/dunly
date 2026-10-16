import Link from "next/link";
import { notFound } from "next/navigation";
import BadgeStatut from "@/components/BadgeStatut";
import BoutonAction from "@/components/BoutonAction";
import FormulaireFacture from "@/components/FormulaireFacture";
import {
  aujourdhuiParis,
  COLONNES_FACTURE,
  formaterDate,
  formaterMontant,
  joursDeRetard,
  statutAffiche,
  type Facture,
} from "@/lib/facture";
import { creerClientServeur } from "@/lib/supabase/server";
import { estUuid } from "@/lib/validation";

type FactureAvecClient = Facture & {
  clients: { id: string; nom: string; email: string | null } | null;
};

export default async function DetailFacture({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) notFound();

  const supabase = await creerClientServeur();
  const { data } = await supabase
    .from("factures")
    .select(`${COLONNES_FACTURE}, clients(id, nom, email)`)
    .eq("id", id)
    .maybeSingle();

  const facture = data as unknown as FactureAvecClient | null;

  if (!facture) {
    notFound();
  }

  const { data: clients } = await supabase.from("clients").select("id, nom").order("nom");

  const aujourdhui = aujourdhuiParis();
  const affiche = statutAffiche(facture, aujourdhui);
  const retard = joursDeRetard(facture, aujourdhui);

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/factures" className="text-blue-600 underline">
        ← Retour aux factures
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Facture {facture.numero ?? "sans numéro"}</h1>
        <BadgeStatut statut={affiche} />
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
            <dt className="text-gray-500">Client</dt>
            <dd>
              {facture.clients ? (
                <Link href={`/clients/${facture.clients.id}`} className="text-blue-600 underline">
                  {facture.clients.nom}
                </Link>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-gray-500">Montant TTC</dt>
            <dd className="font-medium">{formaterMontant(facture.montant_ttc)}</dd>
            <dt className="text-gray-500">Émise le</dt>
            <dd>{formaterDate(facture.emise_le)}</dd>
            <dt className="text-gray-500">Échéance</dt>
            <dd>
              {formaterDate(facture.echeance)}
              {retard > 0 && <span className="ml-2 text-red-700">({retard} jours de retard)</span>}
            </dd>
            {facture.payee_le && (
              <>
                <dt className="text-gray-500">Payée le</dt>
                <dd>{new Date(facture.payee_le).toLocaleDateString("fr-FR")}</dd>
              </>
            )}
          </dl>

          {!facture.brouillon && (
            <div className="flex flex-wrap gap-2">
              {facture.statut === "en_attente" ? (
                <BoutonAction
                  url={`/api/factures/${facture.id}/statut`}
                  corps={{ statut: "payee" }}
                  libelle="Marquer payée"
                  libelleEnCours="Enregistrement…"
                  confirmation="Marquer cette facture comme payée ? Toutes les relances seront arrêtées."
                />
              ) : (
                <BoutonAction
                  url={`/api/factures/${facture.id}/statut`}
                  corps={{ statut: "en_attente" }}
                  libelle="Remettre en attente"
                  libelleEnCours="Enregistrement…"
                  confirmation="Annuler le paiement de cette facture ? Les relances pourront reprendre."
                  variante="secondaire"
                />
              )}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            {facture.brouillon ? "Vérifier et valider" : "Modifier"}
          </h2>
          <FormulaireFacture
            clients={clients ?? []}
            facture={{
              id: facture.id,
              brouillon: facture.brouillon,
              client_id: facture.client_id ?? "",
              numero: facture.numero ?? "",
              montant_ttc:
                facture.montant_ttc === null ? "" : String(facture.montant_ttc).replace(".", ","),
              emise_le: facture.emise_le ?? "",
              echeance: facture.echeance ?? "",
            }}
          />
          <BoutonAction
            url={`/api/factures/${facture.id}`}
            methode="DELETE"
            libelle="Supprimer la facture"
            libelleEnCours="Suppression…"
            confirmation="Supprimer définitivement cette facture et ses relances ?"
            redirection="/factures"
            variante="danger"
          />
        </aside>
      </div>
    </main>
  );
}
