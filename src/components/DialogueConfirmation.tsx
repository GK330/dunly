"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Warning } from "@phosphor-icons/react";

type Props = {
  ouvert: boolean;
  titre: string;
  message: string;
  libelleConfirmer: string;
  danger?: boolean;
  onConfirmer: () => void;
  onAnnuler: () => void;
};

// Fenêtre de confirmation aux couleurs de Dunly, à la place de window.confirm
export default function DialogueConfirmation({
  ouvert,
  titre,
  message,
  libelleConfirmer,
  danger = false,
  onConfirmer,
  onAnnuler,
}: Props) {
  const boutonConfirmer = useRef<HTMLButtonElement>(null);

  // Échap ferme la fenêtre ; le bouton de confirmation reçoit le focus à l'ouverture
  useEffect(() => {
    if (!ouvert) return;
    boutonConfirmer.current?.focus();

    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") onAnnuler();
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert, onAnnuler]);

  return (
    <AnimatePresence>
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-cacao/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onAnnuler}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmation-titre"
            aria-describedby="confirmation-message"
            className="carte relative w-full max-w-md p-6 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <span
              className={`flex size-11 items-center justify-center rounded-2xl ${
                danger ? "bg-red-50 text-red-700" : "bg-abricot text-mandarine-fonce"
              }`}
            >
              <Warning weight="duotone" className="size-6" aria-hidden />
            </span>
            <h2 id="confirmation-titre" className="mt-4 font-titre text-xl font-semibold">
              {titre}
            </h2>
            <p id="confirmation-message" className="mt-2 text-brun">
              {message}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onAnnuler} className="btn btn-secondaire">
                Annuler
              </button>
              <button
                ref={boutonConfirmer}
                type="button"
                onClick={onConfirmer}
                className={`btn ${danger ? "btn-danger" : "btn-primaire"}`}
              >
                {libelleConfirmer}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
