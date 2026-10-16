import Link from "next/link";
import FormulaireClient from "@/components/FormulaireClient";
import type { Client } from "@/lib/facture";
import { creerClientServeur } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ListeClients() {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("clients")
    .select("id, nom, email, created_at")
    .order("nom");

  const clients = (data ?? []) as Client[];

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Clients</h1>

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_320px]">
        <section>
          {error && <p className="text-red-700">Impossible de charger les clients.</p>}

          {!error && clients.length === 0 && (
            <p className="text-gray-600">Aucun client pour l’instant.</p>
          )}

          <ul className="flex flex-col gap-3">
            {clients.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/clients/${client.id}`}
                  className="block rounded border p-4 hover:bg-gray-50"
                >
                  <p className="font-medium">{client.nom}</p>
                  <p className="text-sm text-gray-500">
                    {client.email ?? "Aucune adresse e-mail : relances impossibles"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside>
          <h2 className="mb-3 text-lg font-semibold">Nouveau client</h2>
          <FormulaireClient />
        </aside>
      </div>
    </main>
  );
}
