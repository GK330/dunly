import Link from "next/link";
import BoutonDeconnexion from "@/components/BoutonDeconnexion";
import { creerClientServeur } from "@/lib/supabase/server";

const LIENS = [{ href: "/", libelle: "Tableau de bord" }];

export default async function EnTete() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 p-4 text-sm">
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/" className="font-semibold">
            Encaisse
          </Link>
          {LIENS.map((lien) => (
            <Link key={lien.href} href={lien.href} className="text-gray-700 hover:underline">
              {lien.libelle}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <span className="text-gray-600">{user.email}</span>
          <BoutonDeconnexion />
        </div>
      </div>
    </header>
  );
}
