import { redirect } from "next/navigation";
import FormulaireParametres from "@/components/FormulaireParametres";
import { lireParametres } from "@/lib/parametres";
import { creerClientServeur } from "@/lib/supabase/server";

export default async function PageParametres() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const parametres = await lireParametres(supabase, user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="titre-page">Paramètres</h1>
      <div className="mt-6">
        <FormulaireParametres parametres={parametres} />
      </div>
    </main>
  );
}
