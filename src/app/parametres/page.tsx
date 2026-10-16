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
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Paramètres</h1>
      <div className="mt-6">
        <FormulaireParametres parametres={parametres} />
      </div>
    </main>
  );
}
