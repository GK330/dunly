import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ChatCircleText,
  Check,
  CreditCard,
  FilePdf,
  GlobeHemisphereWest,
  HandHeart,
  Lock,
  PaperPlaneTilt,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react/ssr";
import Apparition from "@/components/Apparition";
import ShapeHero, { type HeroShape } from "@/components/kokonutui/shape-hero";
import { creerClientServeur } from "@/lib/supabase/server";

const PAGE_STATUT = "https://stats.uptimerobot.com/BFFIWRvpQ7";

// Étiquettes de factures qui tombent dans le hero et qu'on peut lancer à la souris
const GRANDE = "h-11 px-5 text-base font-medium tracking-tight sm:h-14 sm:px-7 sm:text-lg";
const PETITE = "h-10 px-4 text-sm font-medium sm:h-12 sm:px-5 sm:text-base";
const BLANCHE = "border border-grege bg-white text-cacao";

const FORMES: HeroShape[] = [
  {
    id: "payee",
    content: (
      <span className="flex items-center gap-2">
        <Check weight="bold" className="size-5" aria-hidden /> Payée
      </span>
    ),
    className: `${GRANDE} bg-emerald-600 text-white`,
  },
  { id: "montant", content: "800,00 €", className: `${GRANDE} onglet-actif text-white` },
  {
    id: "relance",
    content: (
      <span className="flex items-center gap-2">
        <PaperPlaneTilt weight="duotone" className="size-5 text-mandarine" aria-hidden /> Relance
        envoyée
      </span>
    ),
    className: `${GRANDE} ${BLANCHE}`,
  },
  { id: "point-1", className: "size-12 bg-cacao sm:size-16" },
  { id: "numero", content: "F2026-042", className: `${PETITE} ${BLANCHE} font-mono` },
  { id: "retard", content: "En retard · 15 j", className: `${PETITE} border border-red-200 bg-white text-red-700` },
  { id: "urssaf", content: "URSSAF 24,6 %", className: `${PETITE} bg-abricot text-mandarine-fonce` },
  { id: "point-2", className: "size-10 onglet-actif sm:size-12" },
  {
    id: "lu",
    content: (
      <span className="flex items-center gap-2">
        <Sparkle weight="duotone" className="size-5 text-mandarine" aria-hidden /> Lue par l’IA
      </span>
    ),
    className: `${PETITE} ${BLANCHE}`,
  },
  { id: "verser", content: "À vous verser : 603 €", className: `${GRANDE} bg-cacao text-white` },
  { id: "promesse", content: "Promesse de paiement", className: `${PETITE} bg-abricot text-mandarine-fonce` },
  { id: "point-3", className: "size-8 bg-emerald-600 sm:size-10" },
];

const ETAPES = [
  {
    icone: FilePdf,
    titre: "Déposez vos factures",
    texte:
      "Glissez vos PDF : l’IA relève le client, le montant et l’échéance. Vous vérifiez d’un coup d’œil.",
  },
  {
    icone: PaperPlaneTilt,
    titre: "Dunly relance pour vous",
    texte:
      "À J+3, J+15 puis J+30, une relance adaptée au client est préparée. Elle part quand vous la validez.",
  },
  {
    icone: CreditCard,
    titre: "Vous encaissez",
    texte:
      "Votre client paie par carte depuis le lien de la relance. La facture passe en payée, les relances s’arrêtent.",
  },
];

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

      <ShapeHero
        className="-mt-16 min-h-[920px] sm:min-h-[840px]"
        eyebrow={
          <span className="inline-flex items-center gap-2 rounded-full border border-grege bg-white/80 px-3 py-1 text-sm text-brun shadow-sm">
            <Sparkle weight="duotone" className="size-4 text-mandarine" aria-hidden />
            Pour les indépendants qui détestent relancer
          </span>
        }
        title={
          <>
            Vos factures payées, <span className="text-mandarine-fonce">sans courir après.</span>
          </>
        }
        description="Déposez vos factures en PDF. Dunly repère les retards, prépare des relances adaptées à chaque client et vous dit ce que vous pouvez vous verser."
        actions={
          <>
            <Link href="/connexion" className="btn btn-primaire px-6 py-3 text-base">
              Commencer gratuitement
              <ArrowRight weight="bold" className="size-4" aria-hidden />
            </Link>
            <a href="#fonctionnement" className="btn btn-secondaire px-6 py-3 text-base">
              Voir comment ça marche
            </a>
          </>
        }
        shapes={FORMES}
        fill={0.28}
      />

      <section id="fonctionnement" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
        <Apparition>
          <p className="text-sm font-semibold tracking-[0.18em] text-mandarine-fonce uppercase">
            Comment ça marche
          </p>
          <h2 className="mt-2 max-w-2xl font-titre text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Trois étapes, et plus une seule relance à écrire.
          </h2>
        </Apparition>

        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {ETAPES.map((etape, index) => (
            <li key={etape.titre}>
              <Apparition delai={index * 0.08} className="carte h-full p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-abricot text-mandarine-fonce">
                    <etape.icone weight="duotone" className="size-6" aria-hidden />
                  </span>
                  <span className="font-mono text-sm text-brun">Étape {index + 1}</span>
                </div>
                <h3 className="mt-5 font-titre text-xl font-semibold">{etape.titre}</h3>
                <p className="mt-2 text-brun">{etape.texte}</p>
              </Apparition>
            </li>
          ))}
        </ol>
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
