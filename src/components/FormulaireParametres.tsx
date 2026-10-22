"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  parametres: {
    nom_affiche: string;
    signature: string;
    taux_cotisations: number;
  };
};

export default function FormulaireParametres({ parametres }: Props) {
  const router = useRouter();
  const [nomAffiche, setNomAffiche] = useState(parametres.nom_affiche);
  const [signature, setSignature] = useState(parametres.signature);
  const [taux, setTaux] = useState(
    String(Math.round(parametres.taux_cotisations * 10000) / 100).replace(".", ",")
  );
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setChargement(true);
    setErreur("");
    setSucces("");

    try {
      const reponse = await fetch("/api/parametres", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom_affiche: nomAffiche,
          signature,
          taux_cotisations: taux,
        }),
      });
      const donnees = await reponse.json();

      if (!reponse.ok) {
        setErreur(donnees.erreur ?? "Une erreur est survenue.");
        return;
      }

      setSucces("Paramètres enregistrés.");
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <form onSubmit={envoyer} className="carte flex flex-col gap-4 p-5">
      <div>
        <label htmlFor="nom-affiche" className="block font-medium">
          Votre nom ou celui de votre activité
        </label>
        <input
          id="nom-affiche"
          value={nomAffiche}
          onChange={(e) => setNomAffiche(e.target.value)}
          maxLength={100}
          placeholder="Léa Martin – Graphiste"
          className="champ mt-1"
        />
      </div>

      <div>
        <label htmlFor="signature" className="block font-medium">
          Signature des relances
        </label>
        <textarea
          id="signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          maxLength={500}
          placeholder={"Léa Martin\nGraphiste indépendante\n06 12 34 56 78"}
          className="champ mt-1 h-28"
        />
      </div>

      <div>
        <label htmlFor="taux" className="block font-medium">
          Taux de cotisations URSSAF (%)
        </label>
        <input
          id="taux"
          inputMode="decimal"
          value={taux}
          onChange={(e) => setTaux(e.target.value)}
          className="champ mt-1 w-40"
        />
        <p className="mt-1 text-sm text-stone-500">
          Part de chaque encaissement à mettre de côté. Vérifiez le taux qui correspond à votre
          activité sur le site de l’URSSAF.
        </p>
      </div>

      <button
        type="submit"
        disabled={chargement}
        className="btn btn-primaire"
      >
        {chargement ? "Enregistrement…" : "Enregistrer"}
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
