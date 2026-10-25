import Link from "next/link";
import { notFound } from "next/navigation";
import ActualisationTempsReel from "@/components/ActualisationTempsReel";
import BadgeAnalyse from "@/components/BadgeAnalyse";
import BadgeRelance from "@/components/BadgeRelance";
import BadgeStatut from "@/components/BadgeStatut";
import BoutonAction from "@/components/BoutonAction";
import FormulaireFacture from "@/components/FormulaireFacture";
import { LectureIAPanneau } from "@/components/LectureIA";
import type { Relance } from "@/lib/contexte-relance";
import type { Extraction } from "@/lib/extraction";
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
import { LIBELLES_NIVEAU } from "@/lib/relances";
import { creerClientServeur } from "@/lib/supabase/server";
import { estUuid } from "@/lib/validation";

type FactureDetaillee = Facture & {
  fichier_chemin: string | null;
  donnees_extraites: (Extraction & { validee_automatiquement?: boolean }) | null;
  relances_arretees: boolean;
  relances_en_pause_jusqu_au: string | null;
  jeton_paiement: string;
  lien_ouvert_le: string | null;
  payee_par_carte: boolean;
  clients: { id: string; nom: string; email: string | null } | null;
};

export default async function DetailFacture({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) notFound();

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("factures")
    .select(
      `${COLONNES_FACTURE}, fichier_chemin, donnees_extraites, relances_arretees, relances_en_pause_jusqu_au, jeton_paiement, lien_ouvert_le, payee_par_carte, clients(id, nom, email)`
    )
    .eq("id", id)
    .maybeSingle();

  const facture = data as unknown as FactureDetaillee | null;

  if (!facture) {
    notFound();
  }

  const [{ data: clients }, { data: donneesRelances }, parametres] = await Promise.all([
    supabase.from("clients").select("id, nom").order("nom"),
    supabase
      .from("relances")
      .select("id, niveau, statut, prevue_le, envoyee_le")
      .eq("facture_id", id)
      .order("created_at", { ascending: false }),
    lireParametres(supabase, facture.user_id),
  ]);
  const relances = (donneesRelances ?? []) as Pick<
    Relance,
    "id" | "niveau" | "statut" | "prevue_le" | "envoyee_le"
  >[];

  // URL signée valable cinq minutes : le bucket reste privé
  let lienPdf: string | null = null;
  if (facture.fichier_chemin) {
    const { data: signe } = await supabase.storage
      .from("factures")
      .createSignedUrl(facture.fichier_chemin, 300);
    lienPdf = signe?.signedUrl ?? null;
  }

  const aujourdhui = aujourdhuiParis();
  const affiche = statutAffiche(facture, aujourdhui);
  const retard = joursDeRetard(facture, aujourdhui);
  const extraction = facture.donnees_extraites;
  const relancesEnPause =
    !!facture.relances_en_pause_jusqu_au && facture.relances_en_pause_jusqu_au >= aujourdhui;
  const clientDetecte =
    facture.brouillon && !facture.client_id && extraction?.client_nom ? extraction : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      {user && <ActualisationTempsReel userId={user.id} tables={["factures", "relances"]} />}

      <Link href="/factures" className="lien">
        ← Retour aux factures
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="titre-page">Facture {facture.numero ?? "sans numéro"}</h1>
        <BadgeStatut statut={affiche} />
        {facture.etat_analyse && <BadgeAnalyse analyse={facture.etat_analyse} />}
      </div>

      {lienPdf && (
        <p className="mt-2 text-sm">
          <a href={lienPdf} target="_blank" rel="noopener noreferrer" className="lien">
            Ouvrir le PDF d’origine
          </a>
        </p>
      )}

      {facture.etat_analyse === "en_cours" && <LectureIAPanneau />}

      {facture.etat_analyse === "erreur" && (
        <p className="mt-6 alerte alerte-erreur">
          La lecture du PDF a échoué : {facture.message_erreur ?? "erreur inconnue"} Vous pouvez
          compléter la facture à la main ci-dessous.
        </p>
      )}

      {!facture.brouillon && facture.etat_analyse === "prete" && extraction?.validee_automatiquement && (
        <p className="mt-6 alerte alerte-succes">
          Facture lue et validée automatiquement par l’IA, client compris. Vérifiez les
          informations ci-dessous et corrigez-les si besoin : aucune relance ne partira sans
          votre validation.
        </p>
      )}

      {facture.brouillon && facture.etat_analyse === "prete" && extraction && (
        <div className="mt-6 alerte alerte-info">
          <p>
            Champs pré-remplis par l’IA : vérifiez-les, corrigez-les si besoin, puis validez la
            facture. Elle ne sera relancée qu’après validation.
          </p>
          {extraction.echeance_deduite && (
            <p className="mt-2">
              Aucune échéance lisible : l’échéance proposée est la date d’émission + 30 jours.
            </p>
          )}
          {extraction.champs_a_verifier.length > 0 && (
            <p className="mt-2 font-medium">
              À vérifier en priorité : {extraction.champs_a_verifier.join(", ")}.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-4">
          <dl className="carte grid grid-cols-2 gap-3 p-5 text-sm">
            <dt className="text-stone-500">Client</dt>
            <dd>
              {facture.clients ? (
                <Link href={`/clients/${facture.clients.id}`} className="lien">
                  {facture.clients.nom}
                </Link>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-stone-500">Montant TTC</dt>
            <dd className="font-medium">{formaterMontant(facture.montant_ttc)}</dd>
            <dt className="text-stone-500">Émise le</dt>
            <dd>{formaterDate(facture.emise_le)}</dd>
            <dt className="text-stone-500">Échéance</dt>
            <dd>
              {formaterDate(facture.echeance)}
              {retard > 0 && <span className="ml-2 text-red-700">({retard} jours de retard)</span>}
            </dd>
            {facture.payee_le && (
              <>
                <dt className="text-stone-500">Payée le</dt>
                <dd>
                  {new Date(facture.payee_le).toLocaleDateString("fr-FR")}
                  {facture.payee_par_carte && " (par carte)"}
                </dd>
              </>
            )}
            {!facture.brouillon && facture.statut === "en_attente" && parametres.paiement_carte_actif && (
              <>
                <dt className="text-stone-500">Lien de paiement</dt>
                <dd className="break-all">
                  <a
                    href={`/payer/${facture.jeton_paiement}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lien"
                  >
                    /payer/{facture.jeton_paiement.slice(0, 8)}…
                  </a>
                  <span className="block text-stone-500">
                    {facture.lien_ouvert_le
                      ? `Ouvert par le client le ${new Date(facture.lien_ouvert_le).toLocaleString("fr-FR")}`
                      : "Pas encore ouvert"}
                  </span>
                </dd>
              </>
            )}
          </dl>

          {clientDetecte && (
            <div className="carte p-5 text-sm">
              <p>
                Client détecté dans le PDF : <strong>{clientDetecte.client_nom}</strong>
                {clientDetecte.client_email && <> ({clientDetecte.client_email})</>}. Il ne
                correspond à aucun de vos clients.
              </p>
              <div className="mt-3">
                <BoutonAction
                  url={`/api/factures/${facture.id}/client-detecte`}
                  libelle="Créer ce client"
                  succes="Client créé et rattaché à la facture."
                  libelleEnCours="Création…"
                  variante="secondaire"
                />
              </div>
            </div>
          )}

          {!facture.brouillon && (
            <div className="flex flex-wrap gap-2">
              {facture.statut === "en_attente" ? (
                <BoutonAction
                  url={`/api/factures/${facture.id}/statut`}
                  corps={{ statut: "payee" }}
                  libelle="Marquer payée"
                  libelleEnCours="Enregistrement…"
                  confirmation="La facture passe en payée et toutes ses relances en attente sont annulées."
                  succes="Facture marquée payée."
                />
              ) : (
                <BoutonAction
                  url={`/api/factures/${facture.id}/statut`}
                  corps={{ statut: "en_attente" }}
                  libelle="Remettre en attente"
                  libelleEnCours="Enregistrement…"
                  confirmation="Le paiement est annulé : si la facture est en retard, ses relances reprennent."
                  succes="Facture remise en attente."
                  variante="secondaire"
                />
              )}
            </div>
          )}

          {!facture.brouillon && (
            <div className="carte p-5">
              <h2 className="font-titre text-lg font-semibold">Relances</h2>

              {facture.relances_arretees && (
                <p className="mt-2 text-sm text-red-700">Relances arrêtées pour cette facture.</p>
              )}
              {!facture.relances_arretees && relancesEnPause && (
                <p className="mt-2 text-sm text-brun">
                  Relances en pause jusqu’au {formaterDate(facture.relances_en_pause_jusqu_au)}{" "}
                  inclus.
                </p>
              )}

              {relances.length === 0 ? (
                <p className="mt-2 text-sm text-stone-600">
                  Aucune relance. La première est préparée dès le 3ᵉ jour de retard, et vous êtes
                  prévenu par e-mail.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {relances.map((relance) => (
                    <li key={relance.id} className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/relances/${relance.id}`} className="lien">
                        Niveau {relance.niveau} · {LIBELLES_NIVEAU[relance.niveau]}
                      </Link>
                      <span className="flex items-center gap-2 text-stone-600">
                        {relance.envoyee_le
                          ? `envoyée le ${new Date(relance.envoyee_le).toLocaleDateString("fr-FR")}`
                          : `prévue le ${formaterDate(relance.prevue_le)}`}
                        <BadgeRelance statut={relance.statut} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {facture.statut === "en_attente" && (
                <div className="mt-4">
                  {facture.relances_arretees || relancesEnPause ? (
                    <BoutonAction
                      url={`/api/factures/${facture.id}/relances`}
                      corps={{ action: "reprendre" }}
                      libelle="Reprendre les relances"
                      succes="Relances reprises."
                      libelleEnCours="Enregistrement…"
                      variante="secondaire"
                    />
                  ) : (
                    <BoutonAction
                      url={`/api/factures/${facture.id}/relances`}
                      corps={{ action: "arreter" }}
                      libelle="Arrêter les relances"
                      libelleEnCours="Enregistrement…"
                      confirmation="Plus aucune relance ne sera envoyée pour cette facture. Vous pourrez les reprendre plus tard."
                      succes="Relances arrêtées."
                      variante="danger"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          {facture.etat_analyse !== "en_cours" && (
            <>
              <h2 className="font-titre text-lg font-semibold">
                {facture.brouillon ? "Vérifier et valider" : "Modifier"}
              </h2>
              <FormulaireFacture
                key={`${facture.client_id}-${facture.etat_analyse}`}
                clients={clients ?? []}
                facture={{
                  id: facture.id,
                  brouillon: facture.brouillon,
                  client_id: facture.client_id ?? "",
                  numero: facture.numero ?? "",
                  montant_ttc:
                    facture.montant_ttc === null
                      ? ""
                      : String(facture.montant_ttc).replace(".", ","),
                  emise_le: facture.emise_le ?? "",
                  echeance: facture.echeance ?? "",
                }}
              />
            </>
          )}
          <BoutonAction
            url={`/api/factures/${facture.id}`}
            methode="DELETE"
            libelle="Supprimer la facture"
            libelleEnCours="Suppression…"
            confirmation="La facture, son PDF et ses relances seront supprimés définitivement."
            succes="Facture supprimée."
            redirection="/factures"
            variante="danger"
          />
        </aside>
      </div>
    </main>
  );
}
