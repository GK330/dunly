"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DialogueConfirmation from "@/components/DialogueConfirmation";

type Props = {
  url: string;
  methode?: "POST" | "PATCH" | "DELETE";
  corps?: Record<string, unknown>;
  libelle: string;
  libelleEnCours?: string;
  confirmation?: string;
  succes?: string;
  redirection?: string;
  variante?: "principal" | "secondaire" | "danger";
};

const CLASSES = {
  principal: "btn-primaire",
  secondaire: "btn-secondaire",
  danger: "btn-danger",
};

// Bouton qui appelle une route du back, puis rafraîchit la page ou redirige.
// Confirmation dans une fenêtre de Dunly, résultat annoncé par un toast.
export default function BoutonAction({
  url,
  methode = "POST",
  corps,
  libelle,
  libelleEnCours = "Patientez…",
  confirmation,
  succes,
  redirection,
  variante = "principal",
}: Props) {
  const router = useRouter();
  const [chargement, setChargement] = useState(false);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const fermerConfirmation = useCallback(() => setConfirmationOuverte(false), []);

  async function executer() {
    setConfirmationOuverte(false);
    setChargement(true);

    try {
      const reponse = await fetch(url, {
        method: methode,
        headers: corps ? { "Content-Type": "application/json" } : undefined,
        body: corps ? JSON.stringify(corps) : undefined,
      });
      const donnees = await reponse.json().catch(() => ({}));

      if (!reponse.ok) {
        toast.error(donnees.erreur ?? "Une erreur est survenue.");
        return;
      }

      toast.success(succes ?? donnees.message ?? "C’est fait.");

      if (redirection) {
        router.push(redirection);
      }
      router.refresh();
    } catch {
      toast.error("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (confirmation ? setConfirmationOuverte(true) : executer())}
        disabled={chargement}
        className={`btn ${CLASSES[variante]}`}
      >
        {chargement ? libelleEnCours : libelle}
      </button>
      {confirmation && (
        <DialogueConfirmation
          ouvert={confirmationOuverte}
          titre={`${libelle} ?`}
          message={confirmation}
          libelleConfirmer={libelle}
          danger={variante === "danger"}
          onConfirmer={executer}
          onAnnuler={fermerConfirmation}
        />
      )}
    </>
  );
}
