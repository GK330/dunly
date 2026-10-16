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
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-3xl font-bold">Encaisse</h1>
      <p className="mt-2 text-gray-600">
        Vos factures relancées automatiquement, vos encaissements sous contrôle. Saisissez
        votre adresse e-mail : vous recevrez un lien pour vous connecter, sans mot de passe.
      </p>
      <FormulaireConnexion erreurLien={erreur === "lien-invalide"} />
    </main>
  );
}
