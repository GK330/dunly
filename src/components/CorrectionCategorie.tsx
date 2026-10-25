"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, LIBELLES_CATEGORIE, type Categorie } from "@/lib/classification";

export default function CorrectionCategorie({
  reponseId,
  categorie,
}: {
  reponseId: string;
  categorie: Categorie;
}) {
  const router = useRouter();
  const [valeur, setValeur] = useState<Categorie>(categorie);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  async function corriger(nouvelle: Categorie) {
    setValeur(nouvelle);
    setChargement(true);
    setErreur("");

    try {
      const reponse = await fetch(`/api/reponses/${reponseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorie: nouvelle }),
      });
      const donnees = await reponse.json();

      if (!reponse.ok) {
        setErreur(donnees.erreur ?? "Une erreur est survenue.");
        setValeur(categorie);
        return;
      }

      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur.");
      setValeur(categorie);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div>
      <label className="text-sm text-stone-600">
        Catégorie{" "}
        <select
          value={valeur}
          disabled={chargement}
          onChange={(e) => corriger(e.target.value as Categorie)}
          className="champ ml-1 w-auto py-1 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {LIBELLES_CATEGORIE[c].libelle}
            </option>
          ))}
        </select>
      </label>
      {erreur && <p className="mt-1 text-sm text-red-700">{erreur}</p>}
    </div>
  );
}
