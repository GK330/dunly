import Link from "next/link";
import FormulaireFacture from "@/components/FormulaireFacture";
import { creerClientServeur } from "@/lib/supabase/server";

export default async function NouvelleFacture() {
  const supabase = await creerClientServeur();
  const { data: clients } = await supabase.from("clients").select("id, nom").order("nom");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/factures" className="lien">
        ← Retour aux factures
      </Link>
      <h1 className="titre-page mt-4">Saisir une facture</h1>
      <div className="mt-6">
        <FormulaireFacture clients={clients ?? []} />
      </div>
    </main>
  );
}
