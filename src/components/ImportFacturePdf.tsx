"use client";

import { useState } from "react";
import FileUpload, { type UploadHelpers } from "@/components/kokonutui/file-upload";
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
    throw new Error("L’envoi du fichier a échoué. Vérifiez qu’il s’agit d’un PDF de 5 Mo maximum.");
  }

  return chemin;
}

export default function ImportFacturePdf() {
  const [restantes, setRestantes] = useState<number | null>(null);

  // Chaque PDF est déposé dans le dossier privé de l'utilisateur, puis confié à l'IA
  async function envoyer(fichier: File, { onProgress, signal }: UploadHelpers) {
    onProgress(10);
    const cheminFichier = await deposerPdf(fichier);
    if (signal.aborted) return;

    onProgress(70);
    const reponse = await fetch("/api/factures/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cheminFichier }),
      signal,
    });
    const donnees = await reponse.json().catch(() => ({}));

    const entete = reponse.headers.get("X-RateLimit-Remaining");
    if (entete !== null) setRestantes(Number(entete));

    if (!reponse.ok) {
      throw new Error(donnees.erreur ?? "La lecture n’a pas pu être lancée.");
    }

    onProgress(100);
  }

  return (
    <div>
      <FileUpload
        onUpload={envoyer}
        acceptedFileTypes={["application/pdf"]}
        maxFileSize={TAILLE_MAX_PDF}
        maxFiles={5}
      />
      <p className="mt-2 text-sm text-brun">
        L’IA lit chaque facture en arrière-plan : elle apparaît dans la liste ci-dessous dès
        qu’elle est lue, avec son client et son statut.
        {restantes !== null &&
          (restantes > 0
            ? ` Encore ${restantes} lecture(s) possible(s) cette heure-ci.`
            : " Quota de lectures atteint pour cette heure-ci.")}
      </p>
    </div>
  );
}
