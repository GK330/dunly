"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  url: string;
  methode?: "POST" | "PATCH" | "DELETE";
  corps?: Record<string, unknown>;
  libelle: string;
  libelleEnCours?: string;
  confirmation?: string;
  redirection?: string;
  variante?: "principal" | "secondaire" | "danger";
};

const CLASSES = {
  principal: "btn-primaire",
  secondaire: "btn-secondaire",
  danger: "btn-danger",
};

// Bouton qui appelle une route du back, puis rafraîchit la page ou redirige
export default function BoutonAction({
  url,
  methode = "POST",
  corps,
  libelle,
  libelleEnCours = "Patientez…",
  confirmation,
  redirection,
  variante = "principal",
}: Props) {
  const router = useRouter();
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  async function executer() {
    if (confirmation && !window.confirm(confirmation)) return;

    setChargement(true);
    setErreur("");

    try {
      const reponse = await fetch(url, {
        method: methode,
        headers: corps ? { "Content-Type": "application/json" } : undefined,
        body: corps ? JSON.stringify(corps) : undefined,
      });
      const donnees = await reponse.json().catch(() => ({}));

      if (!reponse.ok) {
        setErreur(donnees.erreur ?? "Une erreur est survenue.");
        return;
      }

      if (redirection) {
        router.push(redirection);
      }
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={executer}
        disabled={chargement}
        className={`btn ${CLASSES[variante]}`}
      >
        {chargement ? libelleEnCours : libelle}
      </button>
      {erreur && <p className="mt-2 text-sm text-red-700">{erreur}</p>}
    </div>
  );
}
