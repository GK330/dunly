import Link from "next/link";
import { redirect } from "next/navigation";
import ActualisationTempsReel from "@/components/ActualisationTempsReel";
import CorrectionCategorie from "@/components/CorrectionCategorie";
import { LIBELLES_CATEGORIE, type Categorie } from "@/lib/classification";
import { formaterDate } from "@/lib/facture";
import { creerClientServeur } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Reponse = {
  id: string;
  facture_id: string;
  expediteur: string;
  sujet: string | null;
  corps: string;
  categorie: Categorie | null;
  date_promise: string | null;
  action_appliquee: string | null;
  corrigee_par_utilisateur: boolean;
  recue_le: string;
  factures: { numero: string; clients: { nom: string } | null } | null;
};

export default async function ListeReponses() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data, error } = await supabase
    .from("reponses_clients")
    .select(
      "id, facture_id, expediteur, sujet, corps, categorie, date_promise, action_appliquee, corrigee_par_utilisateur, recue_le, factures(numero, clients(nom))"
    )
    .order("recue_le", { ascending: false })
    .limit(100);

  const reponses = (data ?? []) as unknown as Reponse[];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <ActualisationTempsReel userId={user.id} tables={["reponses_clients"]} />

      <h1 className="titre-page">Réponses des clients</h1>
      <p className="mt-2 max-w-3xl text-stone-600">
        Les réponses à vos relances sont classées par l’IA dans une catégorie fixe. Corrigez la
        catégorie si elle est fausse : la correction est enregistrée, mais elle n’annule pas
        l’action automatique déjà appliquée (utilisez les boutons de la facture).
      </p>

      {error && <p className="mt-6 alerte alerte-erreur">Impossible de charger les réponses.</p>}

      {!error && reponses.length === 0 && (
        <p className="mt-6 carte p-6 text-stone-600">
          Aucune réponse pour l’instant. Quand un client répond à une relance, sa réponse
          apparaît ici, classée par l’IA.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {reponses.map((reponse) => (
          <li key={reponse.id} className="carte p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{reponse.expediteur}</p>
                <p className="text-sm text-stone-500">
                  Reçue le {new Date(reponse.recue_le).toLocaleString("fr-FR")} ·{" "}
                  <Link href={`/factures/${reponse.facture_id}`} className="lien">
                    facture n° {reponse.factures?.numero ?? "?"}
                  </Link>
                  {reponse.factures?.clients && <> ({reponse.factures.clients.nom})</>}
                </p>
              </div>

              {reponse.categorie ? (
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${LIBELLES_CATEGORIE[reponse.categorie].classes}`}
                  >
                    {LIBELLES_CATEGORIE[reponse.categorie].libelle}
                    {reponse.corrigee_par_utilisateur ? " (corrigée)" : " (proposée par l’IA)"}
                  </span>
                  <CorrectionCategorie reponseId={reponse.id} categorie={reponse.categorie} />
                </div>
              ) : (
                <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                  Classification en cours…
                </span>
              )}
            </div>

            {reponse.sujet && <p className="mt-3 text-sm font-medium">{reponse.sujet}</p>}
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-papier p-3 font-sans text-sm text-stone-800">
              {reponse.corps}
            </pre>

            {reponse.date_promise && (
              <p className="mt-2 text-sm">Date de paiement promise : {formaterDate(reponse.date_promise)}</p>
            )}
            {reponse.action_appliquee && (
              <p className="mt-2 text-sm text-stone-600">Action automatique : {reponse.action_appliquee}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
