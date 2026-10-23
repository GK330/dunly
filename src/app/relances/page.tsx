import Link from "next/link";
import { redirect } from "next/navigation";
import ActualisationTempsReel from "@/components/ActualisationTempsReel";
import BadgeRelance from "@/components/BadgeRelance";
import type { Relance } from "@/lib/contexte-relance";
import { formaterDate, formaterMontant } from "@/lib/facture";
import { lireParametres } from "@/lib/parametres";
import { LIBELLES_NIVEAU } from "@/lib/relances";
import { creerClientServeur } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RelanceAvecFacture = Relance & {
  factures: { id: string; numero: string; montant_ttc: number; clients: { nom: string } | null } | null;
};

const ORDRE = { brouillon: 0, validee: 1, envoyee: 2, annulee: 3 };

export default async function ListeRelances() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const [{ data, error }, parametres] = await Promise.all([
    supabase
      .from("relances")
      .select(
        "id, niveau, statut, prevue_le, contenu, origine_contenu, envoyee_le, created_at, factures(id, numero, montant_ttc, clients(nom))"
      )
      .order("prevue_le", { ascending: false })
      .limit(100),
    lireParametres(supabase, user.id),
  ]);

  const relances = ((data ?? []) as unknown as RelanceAvecFacture[]).sort(
    (a, b) => ORDRE[a.statut] - ORDRE[b.statut]
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <ActualisationTempsReel userId={user.id} tables={["relances", "factures"]} />

      <h1 className="titre-page">Relances</h1>
      <p className="mt-2 text-stone-600">
        Dunly prépare chaque jour les relances des factures en retard : à 3 jours (rappel
        courtois), 15 jours (relance ferme) et 30 jours (rappel des pénalités).{" "}
        {parametres.validation_relances
          ? "Aucune relance ne part sans votre validation."
          : "Sans action de votre part, chaque relance part automatiquement le jour prévu."}{" "}
        <Link href="/parametres" className="underline">
          Modifier ce réglage
        </Link>
      </p>

      {error && <p className="mt-6 text-red-700">Impossible de charger les relances.</p>}

      {!error && relances.length === 0 && (
        <p className="mt-6 text-stone-600">Aucune relance pour l’instant.</p>
      )}

      {relances.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Facture</th>
                <th className="p-2">Client</th>
                <th className="p-2">Niveau</th>
                <th className="p-2">Prévue le</th>
                <th className="p-2">Statut</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {relances.map((relance) => (
                <tr key={relance.id} className="border-b align-top hover:bg-abricot/30">
                  <td className="p-2">
                    {relance.factures ? (
                      <Link href={`/factures/${relance.factures.id}`} className="underline">
                        n° {relance.factures.numero}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <p className="text-stone-500">
                      {formaterMontant(relance.factures ? Number(relance.factures.montant_ttc) : null)}
                    </p>
                  </td>
                  <td className="p-2">{relance.factures?.clients?.nom ?? "—"}</td>
                  <td className="p-2">
                    {relance.niveau} · {LIBELLES_NIVEAU[relance.niveau]}
                  </td>
                  <td className="p-2">
                    {formaterDate(relance.prevue_le)}
                    {relance.envoyee_le && (
                      <p className="text-stone-500">
                        envoyée le {new Date(relance.envoyee_le).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                  </td>
                  <td className="p-2">
                    <BadgeRelance statut={relance.statut} />
                    {relance.contenu === null && relance.statut === "brouillon" && (
                      <p className="mt-1 text-stone-500">Rédaction en cours…</p>
                    )}
                  </td>
                  <td className="p-2">
                    <Link href={`/relances/${relance.id}`} className="lien">
                      {relance.statut === "brouillon" || relance.statut === "validee"
                        ? "Voir / modifier"
                        : "Voir"}
                    </Link>
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
