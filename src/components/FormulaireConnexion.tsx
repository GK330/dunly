"use client";

import { useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";

export default function FormulaireConnexion({ erreurLien }: { erreurLien: boolean }) {
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState(
    erreurLien ? "Ce lien de connexion est invalide ou a expiré. Demandez-en un nouveau." : ""
  );

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");

    const supabase = creerClientNavigateur();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setEnvoi(false);

    if (error) {
      console.error(error);
      setErreur("L'envoi du lien a échoué. Patientez quelques minutes avant de réessayer.");
      return;
    }

    setEnvoye(true);
  }

  if (envoye) {
    return (
      <p className="mt-6 rounded border border-green-300 bg-green-50 p-4 text-green-800">
        Un lien de connexion vient d’être envoyé à <strong>{email}</strong>. Ouvrez-le
        dans ce même navigateur.
      </p>
    );
  }

  return (
    <form onSubmit={envoyer} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="block font-medium">
          Adresse e-mail
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.com"
          className="mt-1 w-full rounded border p-2"
        />
      </div>

      <button
        type="submit"
        disabled={envoi || email === ""}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {envoi ? "Envoi en cours…" : "Recevoir un lien de connexion"}
      </button>

      {erreur && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{erreur}</p>
      )}
    </form>
  );
}
