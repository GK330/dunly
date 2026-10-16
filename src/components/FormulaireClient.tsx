"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LIMITES } from "@/lib/facture";

type Props = {
  client?: { id: string; nom: string; email: string | null };
};

// Création d'un client, ou modification si un client est fourni
export default function FormulaireClient({ client }: Props) {
  const router = useRouter();
  const [nom, setNom] = useState(client?.nom ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setChargement(true);
    setErreur("");
    setSucces("");

    try {
      const reponse = await fetch(client ? `/api/clients/${client.id}` : "/api/clients", {
        method: client ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, email }),
      });
      const donnees = await reponse.json();

      if (!reponse.ok) {
        setErreur(donnees.erreur ?? "Une erreur est survenue.");
        return;
      }

      if (client) {
        setSucces("Client enregistré.");
      } else {
        setNom("");
        setEmail("");
        setSucces(`Client « ${donnees.nom} » ajouté.`);
      }
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <label htmlFor="nom-client" className="block font-medium">
          Nom du client
        </label>
        <input
          id="nom-client"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          maxLength={LIMITES.nomMax}
          placeholder="Exemple : Boulangerie Martin"
          className="mt-1 w-full rounded border p-2"
        />
      </div>

      <div>
        <label htmlFor="email-client" className="block font-medium">
          E-mail de facturation
        </label>
        <input
          id="email-client"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={LIMITES.emailMax}
          placeholder="compta@exemple.com"
          className="mt-1 w-full rounded border p-2"
        />
        <p className="mt-1 text-sm text-gray-500">Indispensable pour relancer ce client.</p>
      </div>

      <button
        type="submit"
        disabled={chargement || nom.trim() === ""}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {chargement ? "Enregistrement…" : client ? "Enregistrer" : "Ajouter le client"}
      </button>

      {erreur && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{erreur}</p>
      )}
      {succes && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-green-800">{succes}</p>
      )}
    </form>
  );
}
