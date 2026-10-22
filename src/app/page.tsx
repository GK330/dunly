import Link from "next/link";
import { redirect } from "next/navigation";
import { Alarm, HourglassMedium, Receipt } from "@phosphor-icons/react/ssr";
import ActualisationTempsReel from "@/components/ActualisationTempsReel";
import MontantAnime from "@/components/MontantAnime";
import {
  aujourdhuiParis,
  COLONNES_FACTURE,
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
  icone,
  alerte = false,
}: {
  titre: string;
  montant: number;
  detail: string;
  icone: React.ReactNode;
  alerte?: boolean;
}) {
  return (
    <div className={`carte p-5 ${alerte ? "border-red-200" : ""}`}>
      <div className="flex items-center gap-2 text-sm text-brun">
        <span
          className={`flex size-7 items-center justify-center rounded-full ${
            alerte ? "bg-red-50 text-red-700" : "bg-abricot text-mandarine-fonce"
          }`}
        >
          {icone}
        </span>
        {titre}
      </div>
      <MontantAnime
        montant={montant}
        className={`mt-3 block font-titre text-3xl font-bold tracking-tight ${
          alerte ? "text-red-700" : "text-cacao"
        }`}
      />
      <p className="mt-1 text-sm text-brun">{detail}</p>
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

  const jourMidi = new Date(`${aujourdhui}T12:00:00Z`);
  const dateLongue = jourMidi.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });
  const mois = jourMidi.toLocaleDateString("fr-FR", { month: "long", timeZone: "Europe/Paris" });

  const enRetard = factures
    .filter((f) => statutAffiche(f, aujourdhui) === "en_retard")
    .map((f) => ({ ...f, retard: joursDeRetard(f, aujourdhui) }))
    .sort((a, b) => b.retard - a.retard)
    .slice(0, 5);

  const aVerifier = factures.filter((f) => f.brouillon && f.etat_analyse !== "en_cours").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <ActualisationTempsReel userId={user.id} tables={["factures"]} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brun first-letter:uppercase">{dateLongue}</p>
          <h1 className="titre-page mt-1">
            Bonjour{parametres.nom_affiche ? ` ${parametres.nom_affiche}` : ""}
          </h1>
        </div>
        <Link href="/factures" className="btn btn-primaire">
          Déposer une facture
        </Link>
      </div>

      {error && <p className="mt-6 alerte alerte-erreur">Impossible de charger vos factures.</p>}

      {aVerifier > 0 && (
        <p className="mt-6 alerte alerte-info">
          {aVerifier} facture(s) lue(s) par l’IA à vérifier.{" "}
          <Link href="/factures?filtre=brouillon" className="lien">
            Les vérifier
          </Link>
        </p>
      )}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* Ticket du mois : ce que l'indépendant peut se verser, calculé ligne par ligne */}
        <section className="ticket-ombre" aria-label="Ticket du mois">
          <div className="ticket rounded-t-2xl border border-grege bg-white p-6 pb-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-[0.18em] text-brun uppercase">
                Ticket de {mois}
              </p>
              <Receipt weight="duotone" className="size-6 text-mandarine" aria-hidden />
            </div>

            <p className="mt-5 text-sm text-brun">Tu peux te verser</p>
            <MontantAnime
              montant={indicateurs.tuPeuxTeVerser}
              className="mt-1 block font-titre text-5xl font-bold tracking-tight text-cacao"
            />

            <dl className="mt-6 space-y-2 border-t border-dashed border-grege pt-4 font-mono text-sm text-brun">
              <div className="flex justify-between gap-4">
                <dt>
                  Encaissé ({indicateurs.nombrePayeesCeMois} facture
                  {indicateurs.nombrePayeesCeMois > 1 ? "s" : ""})
                </dt>
                <dd className="text-cacao">{formaterMontant(indicateurs.encaisseCeMois)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>URSSAF {pourcentage} %</dt>
                <dd className="text-cacao">− {formaterMontant(indicateurs.aMettreDeCote)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-dashed border-grege pt-2 font-semibold text-cacao">
                <dt>À te verser</dt>
                <dd>{formaterMontant(indicateurs.tuPeuxTeVerser)}</dd>
              </div>
            </dl>

            <p className="mt-5 text-xs text-brun">
              Calculé sur les factures payées ce mois-ci, sans IA.{" "}
              <Link href="/parametres" className="lien">
                Modifier le taux
              </Link>
            </p>
          </div>
        </section>

        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Indicateur
              titre="En attente"
              montant={indicateurs.enAttente}
              detail={`${indicateurs.nombreEnAttente} facture(s) avant échéance`}
              icone={<HourglassMedium weight="duotone" className="size-4" aria-hidden />}
            />
            <Indicateur
              titre="En retard"
              montant={indicateurs.enRetard}
              detail={`${indicateurs.nombreEnRetard} facture(s) à relancer`}
              icone={<Alarm weight="duotone" className="size-4" aria-hidden />}
              alerte={indicateurs.nombreEnRetard > 0}
            />
          </div>

          <section className="carte p-5">
            <h2 className="font-titre text-lg font-semibold">Les plus en retard</h2>
            {enRetard.length === 0 ? (
              <p className="mt-2 text-brun">Aucune facture en retard.</p>
            ) : (
              <ul className="mt-3 divide-y divide-grege">
                {enRetard.map((facture) => (
                  <li key={facture.id}>
                    <Link
                      href={`/factures/${facture.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition hover:bg-abricot/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {facture.clients?.nom ?? "—"}
                        </span>
                        <span className="font-mono text-xs text-brun">n° {facture.numero}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="font-medium">{formaterMontant(facture.montant_ttc)}</span>
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          {facture.retard} j
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
