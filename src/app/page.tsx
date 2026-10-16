import Link from "next/link";
import { redirect } from "next/navigation";
import ActualisationTempsReel from "@/components/ActualisationTempsReel";
import {
  aujourdhuiParis,
  COLONNES_FACTURE,
  formaterDate,
  formaterMontant,
  joursDeRetard,
  statutAffiche,
  type Facture,
} from "@/lib/facture";
import { lireParametres } from "@/lib/parametres";
import { creerClientServeur } from "@/lib/supabase/server";
import { calculerIndicateurs } from "@/lib/tableau-de-bord";

export const dynamic = "force-dynamic";

type FactureAvecClient = Facture & { clients: { nom: string } | null };

function Indicateur({
  titre,
  montant,
  detail,
  classes = "",
}: {
  titre: string;
  montant: number;
  detail: string;
  classes?: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${classes}`}>
      <p className="text-sm text-gray-600">{titre}</p>
      <p className="mt-1 text-2xl font-bold">{formaterMontant(montant)}</p>
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </div>
  );
}

export default async function TableauDeBord() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const [{ data, error }, parametres] = await Promise.all([
    supabase.from("factures").select(`${COLONNES_FACTURE}, clients(nom)`),
    lireParametres(supabase, user.id),
  ]);

  const factures = (data ?? []) as unknown as FactureAvecClient[];
  const aujourdhui = aujourdhuiParis();
  const indicateurs = calculerIndicateurs(factures, parametres.taux_cotisations, aujourdhui);
  const pourcentage = (parametres.taux_cotisations * 100).toLocaleString("fr-FR");

  const enRetard = factures
    .filter((f) => statutAffiche(f, aujourdhui) === "en_retard")
    .map((f) => ({ ...f, retard: joursDeRetard(f, aujourdhui) }))
    .sort((a, b) => b.retard - a.retard)
    .slice(0, 5);

  const aVerifier = factures.filter((f) => f.brouillon && f.etat_analyse !== "en_cours").length;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <ActualisationTempsReel userId={user.id} tables={["factures"]} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Bonjour{parametres.nom_affiche ? ` ${parametres.nom_affiche}` : ""}
          </h1>
          <p className="mt-1 text-gray-600">
            Situation au {formaterDate(aujourdhui)}.
          </p>
        </div>
        <Link href="/factures" className="rounded bg-blue-600 px-4 py-2 text-white">
          Déposer une facture
        </Link>
      </div>

      {error && <p className="mt-6 text-red-700">Impossible de charger vos factures.</p>}

      {aVerifier > 0 && (
        <p className="mt-6 rounded border border-blue-300 bg-blue-50 p-3 text-blue-900">
          {aVerifier} facture(s) lue(s) par l’IA à vérifier.{" "}
          <Link href="/factures?filtre=brouillon" className="font-medium underline">
            Les vérifier
          </Link>
        </p>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Indicateur
          titre="Encaissé ce mois"
          montant={indicateurs.encaisseCeMois}
          detail={`${indicateurs.nombrePayeesCeMois} facture(s) payée(s)`}
        />
        <Indicateur
          titre="En attente"
          montant={indicateurs.enAttente}
          detail={`${indicateurs.nombreEnAttente} facture(s) avant échéance`}
        />
        <Indicateur
          titre="En retard"
          montant={indicateurs.enRetard}
          detail={`${indicateurs.nombreEnRetard} facture(s) à relancer`}
          classes={indicateurs.nombreEnRetard > 0 ? "border-red-300 bg-red-50" : ""}
        />
        <Indicateur
          titre="À mettre de côté pour l’URSSAF"
          montant={indicateurs.aMettreDeCote}
          detail={`${pourcentage} % de l’encaissé ce mois`}
        />
        <Indicateur
          titre="Tu peux te verser"
          montant={indicateurs.tuPeuxTeVerser}
          detail="Encaissé ce mois, cotisations déduites"
          classes="border-green-300 bg-green-50"
        />
      </section>

      <p className="mt-2 text-sm text-gray-500">
        Taux de cotisations modifiable dans les{" "}
        <Link href="/parametres" className="underline">
          paramètres
        </Link>
        . Montants calculés à partir de vos factures, sans IA.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Les plus en retard</h2>
        {enRetard.length === 0 ? (
          <p className="mt-2 text-gray-600">Aucune facture en retard. Bravo !</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {enRetard.map((facture) => (
              <li key={facture.id}>
                <Link
                  href={`/factures/${facture.id}`}
                  className="flex items-center justify-between rounded border p-3 hover:bg-gray-50"
                >
                  <span>
                    <span className="font-medium">{facture.clients?.nom ?? "—"}</span>{" "}
                    <span className="text-sm text-gray-500">· n° {facture.numero}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {formaterMontant(facture.montant_ttc)}
                    <span className="text-sm text-red-700">{facture.retard} j de retard</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
