import Image from "next/image";
import { redirect } from "next/navigation";
import FormulaireConnexion from "@/components/FormulaireConnexion";
import { creerClientServeur } from "@/lib/supabase/server";

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const { erreur } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Image
          src="/dunly-logo-favicons/dunly-logo.svg"
          alt="Dunly"
          width={1260}
          height={345}
          priority
          unoptimized
          className="h-11 w-auto"
        />

        <h1 className="mt-8 font-titre text-4xl leading-tight font-bold tracking-tight text-balance text-cacao">
          Vos factures payées, <span className="text-mandarine-fonce">sans courir après.</span>
        </h1>
        <p className="mt-3 text-brun">
          Déposez vos factures : Dunly relance vos clients en retard et vous dit ce que vous
          pouvez vous verser.
        </p>

        <div className="carte mt-8 p-6">
          <p className="font-medium text-cacao">Connexion sans mot de passe</p>
          <p className="mt-1 text-sm text-brun">
            Saisissez votre adresse e-mail : vous recevrez un lien pour vous connecter.
          </p>
          <FormulaireConnexion erreurLien={erreur === "lien-invalide"} />
        </div>
      </div>
    </main>
  );
}
