"use client";

import { useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";

const TAILLE_MAX_PDF = 5 * 1024 * 1024;

async function deposerPdf(fichier: File): Promise<string> {
  const supabase = creerClientNavigateur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Votre session a expiré. Reconnectez-vous.");
  }

  const chemin = `${user.id}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from("factures")
    .upload(chemin, fichier, { contentType: "application/pdf" });

  if (error) {
    console.error(error);
    throw new Error("L'envoi du fichier a échoué. Vérifiez qu'il s'agit d'un PDF de 5 Mo maximum.");
  }

  return chemin;
}

export default function ImportFacturePdf() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [cleFichier, setCleFichier] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [etape, setEtape] = useState("");
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [restantes, setRestantes] = useState<number | null>(null);

  const fichierValide =
    fichier !== null && fichier.type === "application/pdf" && fichier.size <= TAILLE_MAX_PDF;

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!fichier) return;

    setChargement(true);
    setErreur("");
    setSucces("");

    try {
      setEtape("Envoi du fichier…");
      const cheminFichier = await deposerPdf(fichier);

      setEtape("Enregistrement de la demande…");
      const reponse = await fetch("/api/factures/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cheminFichier }),
      });
      const donnees = await reponse.json();

      const entete = reponse.headers.get("X-RateLimit-Remaining");
      if (entete !== null) setRestantes(Number(entete));

      if (!reponse.ok) {
        setErreur(donnees.erreur ?? "Une erreur est survenue.");
        return;
      }

      setFichier(null);
      setCleFichier((cle) => cle + 1);
      setSucces(
        "Facture reçue : l’IA la lit en arrière-plan. Elle apparaît ci-dessous dès qu’elle est lue, avec son client et son statut."
      );
    } catch (err) {
      setErreur(
        err instanceof TypeError ? "Impossible de contacter le serveur." : (err as Error).message
      );
    } finally {
      setChargement(false);
      setEtape("");
    }
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-3 rounded-lg border p-4">
      <label htmlFor="fichier" className="font-medium">
        Déposer une facture PDF
      </label>
      <input
        key={cleFichier}
        id="fichier"
        type="file"
        accept="application/pdf"
        onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
      />
      <p
        className={`text-sm ${fichier === null || fichierValide ? "text-gray-500" : "text-red-600"}`}
      >
        {fichier
          ? `${fichier.name} (${(fichier.size / 1024 / 1024).toFixed(1)} Mo)`
          : "PDF de 5 Mo maximum, contenant du texte sélectionnable"}
      </p>

      <button
        type="submit"
        disabled={!fichierValide || chargement}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {chargement ? etape : "Lire la facture avec l’IA"}
      </button>

      {restantes !== null && (
        <p className="text-sm text-gray-500">
          {restantes > 0
            ? `Il vous reste ${restantes} lecture(s) de PDF pour l'heure en cours.`
            : "Vous avez utilisé tout votre quota de lectures pour l'heure en cours."}
        </p>
      )}

      {erreur && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{erreur}</p>
      )}
      {succes && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-green-800">{succes}</p>
      )}
    </form>
  );
}
