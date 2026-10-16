import Link from "next/link";
import FormulaireFacture from "@/components/FormulaireFacture";
import { creerClientServeur } from "@/lib/supabase/server";

export default async function NouvelleFacture() {
  const supabase = await creerClientServeur();
  const { data: clients } = await supabase.from("clients").select("id, nom").order("nom");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/factures" className="text-blue-600 underline">
        ← Retour aux factures
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Saisir une facture</h1>
      <div className="mt-6">
        <FormulaireFacture clients={clients ?? []} />
      </div>
    </main>
  );
}
