"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  relanceId: string;
  contenu: string;
  balises: readonly string[];
};

// Modification du corps d'une relance : les balises seront remplacées par les valeurs de la base
export default function EditeurRelance({ relanceId, contenu, balises }: Props) {
  const router = useRouter();
  const [texte, setTexte] = useState(contenu);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setChargement(true);
    setErreur("");
    setSucces("");

    try {
      const reponse = await fetch(`/api/relances/${relanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenu: texte }),
      });
      const donnees = await reponse.json();

      if (!reponse.ok) {
        setErreur(donnees.erreur ?? "Une erreur est survenue.");
        return;
      }

      setSucces("Texte enregistré : l’aperçu est à jour.");
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <form onSubmit={enregistrer} className="flex flex-col gap-3">
      <label htmlFor="contenu" className="font-medium">
        Corps du message
      </label>
      <textarea
        id="contenu"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        maxLength={3000}
        className="champ h-56 text-sm"
      />
      <p className="text-sm text-stone-500">
        Balises remplacées automatiquement par les valeurs de la facture :{" "}
        {balises.map((b) => `{{${b}}}`).join(", ")}. La formule d’appel, le récapitulatif, le
        lien de paiement, les mentions légales et la signature sont ajoutés par Dunly.
      </p>
      <button
        type="submit"
        disabled={chargement || texte.trim() === contenu.trim()}
        className="btn btn-secondaire"
      >
        {chargement ? "Enregistrement…" : "Enregistrer le texte"}
      </button>
      {erreur && (
        <p className="alerte alerte-erreur">{erreur}</p>
      )}
      {succes && (
        <p className="alerte alerte-succes">{succes}</p>
      )}
    </form>
  );
}
