import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ChatCircleText,
  Check,
  CreditCard,
  GlobeHemisphereWest,
  HandGrabbing,
  HandHeart,
  Lock,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react/ssr";
import Apparition from "@/components/Apparition";
import Fonctionnement from "@/components/accueil/Fonctionnement";
import Globe from "@/components/accueil/Globe";
import { VILLES } from "@/components/accueil/villes";
import Tarifs from "@/components/accueil/Tarifs";
import TitreLettres from "@/components/accueil/TitreLettres";
import { creerClientServeur } from "@/lib/supabase/server";

const PAGE_STATUT = "https://stats.uptimerobot.com/BFFIWRvpQ7";

const ATOUTS = [
  {
    icone: HandHeart,
    titre: "Des relances qui ont du tact",
    texte:
      "Un client fidèle qui oublie n’est pas un mauvais payeur : le ton s’adapte à l’historique de chacun.",
  },
  {
    icone: ShieldCheck,
    titre: "Aucun montant inventé",
    texte:
      "L’IA écrit le message, jamais les chiffres : montant, numéro et dates viennent de vos factures.",
  },
  {
    icone: ChatCircleText,
    titre: "Les réponses lues pour vous",
    texte:
      "« Je paie vendredi », « déjà réglé », « je conteste » : chaque réponse est classée et les relances s’adaptent.",
  },
  {
    icone: Check,
    titre: "Rien ne part sans vous",
    texte: "Chaque relance attend votre validation, et un e-mail vous prévient avant l’envoi.",
  },
];

function EnTetePublic() {
  return (
    <header className="sticky top-3 z-40 px-4">
      <div className="entete mx-auto flex max-w-6xl items-center gap-3 rounded-full py-2 pr-2 pl-4">
        <Link href="/" aria-label="Dunly, accueil" className="relative flex shrink-0 items-center">
          <Image
            src="/dunly-logo-favicons/dunly-logo.svg"
            alt="Dunly"
            width={1260}
            height={345}
            priority
            unoptimized
            className="h-7 w-auto"
          />
        </Link>
        <nav className="relative hidden flex-1 items-center justify-center gap-1 text-sm md:flex">
          <a href="#fonctionnement" className="rounded-full px-3 py-1.5 text-brun transition hover:bg-abricot/50 hover:text-cacao">
            Comment ça marche
          </a>
          <a href="#atouts" className="rounded-full px-3 py-1.5 text-brun transition hover:bg-abricot/50 hover:text-cacao">
            Pourquoi Dunly
          </a>
          <a href="#tarifs" className="rounded-full px-3 py-1.5 text-brun transition hover:bg-abricot/50 hover:text-cacao">
            Tarifs
          </a>
        </nav>
        <div className="relative ml-auto flex items-center gap-2">
          <Link href="/connexion" className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-cacao transition hover:bg-abricot/50 sm:block">
            Se connecter
          </Link>
          <Link href="/connexion" className="btn btn-primaire py-2">
            Commencer
          </Link>
        </div>
      </div>
    </header>
  );
}

export default async function Accueil() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Déjà connecté : direction le tableau de bord
  if (user) {
    redirect("/tableau-de-bord");
  }

  return (
    <div className="flex flex-col">
      <EnTetePublic />

      <section className="relative -mt-20 overflow-hidden pt-28 pb-16 sm:pb-20">
        {/* Fond : halo mandarine et trame de points qui s'estompe */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-mandarine/15 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(var(--color-grege)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)] [background-size:22px_22px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-x-10 gap-y-6 px-4 sm:px-6">
          <div className="text-center lg:text-left">
            <Apparition>
              <span className="inline-flex items-center gap-2 rounded-full border border-grege bg-white/80 px-3 py-1 text-sm text-brun shadow-sm">
                <Sparkle weight="duotone" className="size-4 text-mandarine" aria-hidden />
                Pour les indépendants qui détestent relancer
              </span>
            </Apparition>
            <TitreLettres
              texte="Dunly"
              className="mt-3 -ml-[0.04em] font-titre text-[clamp(6rem,27vw,13.5rem)] leading-[0.85] font-extrabold tracking-[-0.06em] text-cacao select-none lg:text-[clamp(8rem,15vw,13.5rem)]"
            />
            <Apparition delai={0.7}>
              <h2 className="mt-5 font-titre text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Vos factures payées, <span className="text-mandarine-fonce">sans courir après.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-brun lg:mx-0">
                Déposez vos factures en PDF. Dunly repère les retards, prépare des relances
                adaptées à chaque client, encaisse par carte et vous dit ce que vous pouvez vous
                verser.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Link href="/connexion" className="btn btn-primaire px-6 py-3 text-base">
                  Commencer gratuitement
                  <ArrowRight weight="bold" className="size-4" aria-hidden />
                </Link>
                <a href="#fonctionnement" className="btn btn-secondaire px-6 py-3 text-base">
                  Voir comment ça marche
                </a>
              </div>
            </Apparition>
          </div>

        </div>
      </section>

      <section id="fonctionnement" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pt-10 pb-10 sm:px-6">
        <Apparition>
          <p className="text-sm font-semibold tracking-[0.18em] text-mandarine-fonce uppercase">
            Comment ça marche
          </p>
          <h2 className="mt-2 max-w-2xl font-titre text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            De la facture déposée à l’argent encaissé, sans écrire une seule relance.
          </h2>
        </Apparition>
        <Fonctionnement />
      </section>

      <section id="atouts" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-20 sm:px-6">
        <Apparition>
          <p className="text-sm font-semibold tracking-[0.18em] text-mandarine-fonce uppercase">
            Pourquoi Dunly
          </p>
          <h2 className="mt-2 max-w-2xl font-titre text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            L’IA rédige, vous gardez la main.
          </h2>
        </Apparition>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
          <ul className="grid gap-5 sm:grid-cols-2">
            {ATOUTS.map((atout, index) => (
              <li key={atout.titre}>
                <Apparition delai={index * 0.06} className="carte h-full p-6">
                  <atout.icone weight="duotone" className="size-7 text-mandarine" aria-hidden />
                  <h3 className="mt-4 font-titre text-lg font-semibold">{atout.titre}</h3>
                  <p className="mt-2 text-brun">{atout.texte}</p>
                </Apparition>
              </li>
            ))}
          </ul>

          {/* Aperçu du ticket du tableau de bord, avec des montants d'exemple */}
          <Apparition delai={0.15} className="ticket-ombre">
            <div className="ticket rounded-t-2xl border border-grege bg-white p-6 pb-10">
              <p className="text-xs font-semibold tracking-[0.18em] text-brun uppercase">
                Exemple · ticket du mois
              </p>
              <p className="mt-5 text-sm text-brun">Vous pouvez vous verser</p>
              <p className="mt-1 font-titre text-5xl font-bold tracking-tight">3 166,80 €</p>
              <dl className="mt-6 space-y-2 border-t border-dashed border-grege pt-4 font-mono text-sm text-brun">
                <div className="flex justify-between gap-4">
                  <dt>Encaissé (5 factures)</dt>
                  <dd className="text-cacao">4 200,00 €</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>URSSAF 24,6 %</dt>
                  <dd className="text-cacao">− 1 033,20 €</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-dashed border-grege pt-2 font-semibold text-cacao">
                  <dt>À vous verser</dt>
                  <dd>3 166,80 €</dd>
                </div>
              </dl>
              <p className="mt-5 text-xs text-brun">
                Calculé à partir de vos factures payées, sans IA.
              </p>
            </div>
          </Apparition>
        </div>

        <Apparition className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-brun">
          <span className="flex items-center gap-2">
            <GlobeHemisphereWest weight="duotone" className="size-5 text-mandarine" aria-hidden />
            Données hébergées en Europe
          </span>
          <span className="flex items-center gap-2">
            <Lock weight="duotone" className="size-5 text-mandarine" aria-hidden />
            Connexion sans mot de passe
          </span>
          <span className="flex items-center gap-2">
            <CreditCard weight="duotone" className="size-5 text-mandarine" aria-hidden />
            Paiements sécurisés par Stripe
          </span>
        </Apparition>
      </section>

      <section id="tarifs" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6">
        <Apparition className="text-center">
          <p className="text-sm font-semibold tracking-[0.18em] text-mandarine-fonce uppercase">
            Tarifs
          </p>
          <h2 className="mx-auto mt-2 max-w-2xl font-titre text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Un prix simple, qui se rembourse dès la première facture récupérée.
          </h2>
        </Apparition>
        <div className="mt-10">
          <Tarifs />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <Apparition className="carte relative overflow-hidden px-6 py-14 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-mandarine/20 blur-3xl"
          />
          <h2 className="relative font-titre text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Arrêtez de courir après vos paiements.
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-brun">
            Connectez-vous avec votre adresse e-mail et déposez votre première facture : Dunly
            s’occupe du reste.
          </p>
          <Link href="/connexion" className="btn btn-primaire relative mt-8 px-6 py-3 text-base">
            Commencer gratuitement
            <ArrowRight weight="bold" className="size-4" aria-hidden />
          </Link>
        </Apparition>
      </section>

      <footer className="border-t border-grege">
        <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-6 sm:px-6">
          <Apparition delai={0.9} className="relative mx-auto w-full max-w-[440px]">
            <Globe />
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-grege bg-white/90 px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur">
                <GlobeHemisphereWest weight="duotone" className="size-5 text-mandarine" aria-hidden />
                Vos clients paient d’où ils veulent
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-brun">
                <HandGrabbing weight="duotone" className="size-4" aria-hidden />
                Faites tourner le globe
              </span>
            </div>
          </Apparition>
          <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-brun">
            Paris → {VILLES.map((ville) => ville.nom).join(" · ")}
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-brun sm:px-6">
          <Image
            src="/dunly-logo-favicons/dunly-logo.svg"
            alt="Dunly"
            width={1260}
            height={345}
            unoptimized
            className="h-6 w-auto"
          />
          <nav className="flex flex-wrap items-center gap-5">
            <a href={PAGE_STATUT} target="_blank" rel="noopener noreferrer" className="hover:text-cacao">
              État du service
            </a>
            <Link href="/connexion" className="hover:text-cacao">
              Se connecter
            </Link>
            <span>© 2026 Dunly</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
