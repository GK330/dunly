import Link from "next/link";
import { notFound } from "next/navigation";
import ActualisationTempsReel from "@/components/ActualisationTempsReel";
import BadgeRelance from "@/components/BadgeRelance";
import BoutonAction from "@/components/BoutonAction";
import EditeurRelance from "@/components/EditeurRelance";
import { chargerContexteRelance, composerRelance } from "@/lib/contexte-relance";
import { formaterDate } from "@/lib/facture";
import { BALISES, LIBELLES_NIVEAU } from "@/lib/relances";
import { creerClientServeur } from "@/lib/supabase/server";
import { estUuid } from "@/lib/validation";

const ORIGINES = {
  ia: "Rédigée par l’IA, puis vérifiée par Dunly",
  modele: "Modèle de texte fixe",
  utilisateur: "Modifiée par vous",
};

export default async function DetailRelance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) notFound();

  // Client serveur : la Row Level Security garantit que la relance appartient à l'utilisateur
  const supabase = await creerClientServeur();
  const contexte = await chargerContexteRelance(supabase, id);

  if (!contexte) {
    notFound();
  }

  const { relance, facture, parametres } = contexte;
  const modifiable = relance.statut === "brouillon" || relance.statut === "validee";
  const apercu = relance.contenu ? composerRelance(contexte) : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <ActualisationTempsReel userId={relance.user_id} tables={["relances"]} />

      <Link href="/relances" className="lien">
        ← Retour aux relances
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="titre-page">
          Relance {relance.niveau} · facture n° {facture.numero}
        </h1>
        <BadgeRelance statut={relance.statut} />
      </div>

      <p className="mt-2 text-stone-600">
        {LIBELLES_NIVEAU[relance.niveau]} pour {facture.clients?.nom ?? "le client"}
        {facture.clients?.email && <> ({facture.clients.email})</>}, prévue le{" "}
        {formaterDate(relance.prevue_le)}.{" "}
        <Link href={`/factures/${facture.id}`} className="underline">
          Voir la facture
        </Link>
      </p>

      {relance.statut === "brouillon" && relance.contenu && (
        <p className="mt-4 alerte alerte-attente">
          {parametres.validation_relances
            ? "Cette relance ne partira que si vous la validez."
            : "Sans action de votre part, cette relance partira automatiquement le jour prévu."}
        </p>
      )}

      {relance.message_generation && (
        <p className="mt-4 alerte border-grege bg-white text-brun">
          {relance.message_generation}
        </p>
      )}

      {!relance.contenu ? (
        <p className="mt-6 alerte alerte-attente">
          Rédaction en cours : cette page se met à jour toute seule.
        </p>
      ) : (
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <section className="min-w-0">
            <h2 className="font-titre text-lg font-semibold">Aperçu de l’e-mail</h2>
            {relance.origine_contenu && (
              <p className="text-sm text-stone-500">{ORIGINES[relance.origine_contenu]}</p>
            )}
            <div className="mt-3 carte p-5 text-sm">
              <p className="font-medium">Objet : {apercu?.sujet}</p>
              <pre className="mt-3 whitespace-pre-wrap font-sans [overflow-wrap:anywhere] text-stone-800">{apercu?.texte}</pre>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-4">
            {modifiable && (
              <>
                <div className="flex flex-wrap gap-2">
                  <BoutonAction
                    url={`/api/relances/${relance.id}/envoyer`}
                    libelle="Valider et envoyer maintenant"
                    libelleEnCours="Envoi…"
                    confirmation={`La relance part tout de suite à ${facture.clients?.nom ?? "votre client"}${facture.clients?.email ? ` (${facture.clients.email})` : ""}.`}
                    succes="Relance validée : elle part dans quelques secondes."
                  />
                  {relance.statut === "brouillon" ? (
                    <BoutonAction
                      url={`/api/relances/${relance.id}/statut`}
                      corps={{ statut: "validee" }}
                      libelle={`Valider pour le ${formaterDate(relance.prevue_le)}`}
                      succes="Relance validée."
                      libelleEnCours="Validation…"
                      variante="secondaire"
                    />
                  ) : (
                    <BoutonAction
                      url={`/api/relances/${relance.id}/statut`}
                      corps={{ statut: "brouillon" }}
                      libelle="Retirer la validation"
                      succes="Validation retirée."
                      libelleEnCours="Enregistrement…"
                      variante="secondaire"
                    />
                  )}
                  <BoutonAction
                    url={`/api/relances/${relance.id}/statut`}
                    corps={{ statut: "annulee" }}
                    libelle="Annuler cette relance"
                    libelleEnCours="Annulation…"
                    confirmation="Cette relance ne sera pas envoyée."
                    succes="Relance annulée."
                    variante="danger"
                  />
                </div>
                <EditeurRelance
                  key={relance.contenu}
                  relanceId={relance.id}
                  contenu={relance.contenu}
                  balises={BALISES}
                />
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
