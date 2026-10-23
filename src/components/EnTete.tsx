import Image from "next/image";
import Link from "next/link";
import BoutonDeconnexion from "@/components/BoutonDeconnexion";
import NavPrincipale from "@/components/NavPrincipale";
import SentryUtilisateur from "@/components/SentryUtilisateur";
import { estAdministrateur } from "@/lib/admin";
import { creerClientServeur } from "@/lib/supabase/server";

const LIENS = [
  { href: "/tableau-de-bord", libelle: "Tableau de bord" },
  { href: "/factures", libelle: "Factures" },
  { href: "/clients", libelle: "Clients" },
  { href: "/relances", libelle: "Relances" },
  { href: "/parametres", libelle: "Paramètres" },
];

export default async function EnTete() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const liens = estAdministrateur(user.email)
    ? [...LIENS, { href: "/admin", libelle: "Admin" }]
    : LIENS;

  return (
    <header className="sticky top-3 z-40 px-4">
      <SentryUtilisateur id={user.id} />
      <div className="entete mx-auto flex max-w-6xl items-center gap-3 rounded-full py-2 pr-2 pl-3">
        <Link href="/tableau-de-bord" aria-label="Dunly, tableau de bord" className="relative flex shrink-0 items-center pl-1">
          {/* Logo complet sur grand écran, le « D » seul sur mobile */}
          <Image
            src="/dunly-logo-favicons/dunly-logo.svg"
            alt="Dunly"
            width={1260}
            height={345}
            priority
            unoptimized
            className="hidden h-7 w-auto sm:block"
          />
          <Image
            src="/dunly-logo-favicons/favicon/favicon.svg"
            alt="Dunly"
            width={330}
            height={330}
            priority
            unoptimized
            className="size-8 sm:hidden"
          />
        </Link>

        <div className="relative min-w-0 flex-1">
          <NavPrincipale liens={liens} />
        </div>

        <div className="relative flex shrink-0 items-center gap-3">
          <span className="hidden max-w-48 truncate text-sm text-brun lg:inline">
            {user.email}
          </span>
          <BoutonDeconnexion />
        </div>
      </div>
    </header>
  );
}
