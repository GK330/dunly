"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LIMITES } from "@/lib/facture";

type Saisie = {
  client_id: string;
  numero: string;
  montant_ttc: string;
  emise_le: string;
  echeance: string;
};

type Props = {
  clients: { id: string; nom: string }[];
  // Absent : création. Présent : modification, ou validation d'un brouillon issu d'un PDF
  facture?: { id: string; brouillon: boolean } & Partial<Saisie>;
};

export default function FormulaireFacture({ clients, facture }: Props) {
  const router = useRouter();
  const [saisie, setSaisie] = useState<Saisie>({
    client_id: facture?.client_id ?? "",
    numero: facture?.numero ?? "",
    montant_ttc: facture?.montant_ttc ?? "",
    emise_le: facture?.emise_le ?? "",
    echeance: facture?.echeance ?? "",
  });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const validation = facture?.brouillon === true;
  const formulaireValide =
    saisie.client_id !== "" &&
    saisie.numero.trim() !== "" &&
    saisie.montant_ttc.trim() !== "" &&
    saisie.emise_le !== "" &&
    saisie.echeance !== "";

  function modifier(champ: keyof Saisie, valeur: string) {
    setSaisie((precedente) => ({ ...precedente, [champ]: valeur }));
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setChargement(true);
    setErreur("");
    setSucces("");

    try {
      const reponse = await fetch(facture ? `/api/factures/${facture.id}` : "/api/factures", {
        method: facture ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saisie),
      });
      const donnees = await reponse.json();

      if (!reponse.ok) {
        setErreur(donnees.erreur ?? "Une erreur est survenue.");
        return;
      }

      if (facture) {
        setSucces(validation ? "Facture validée." : "Facture enregistrée.");
        router.refresh();
      } else {
        router.push(`/factures/${donnees.id}`);
      }
    } catch {
      setErreur("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  if (clients.length === 0) {
    return (
      <p className="alerte alerte-attente">
        Ajoutez d’abord un client dans la page{" "}
        <Link href="/clients" className="font-medium underline">
          Clients
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={envoyer} className="carte flex flex-col gap-3 p-5">
      <div>
        <label htmlFor="client" className="block font-medium">
          Client
        </label>
        <select
          id="client"
          value={saisie.client_id}
          onChange={(e) => modifier("client_id", e.target.value)}
          className="champ mt-1"
        >
          <option value="">Choisissez un client…</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="numero" className="block font-medium">
            Numéro
          </label>
          <input
            id="numero"
            value={saisie.numero}
            onChange={(e) => modifier("numero", e.target.value)}
            maxLength={LIMITES.numeroMax}
            placeholder="2026-042"
            className="champ mt-1"
          />
        </div>
        <div>
          <label htmlFor="montant" className="block font-medium">
            Montant TTC (€)
          </label>
          <input
            id="montant"
            inputMode="decimal"
            value={saisie.montant_ttc}
            onChange={(e) => modifier("montant_ttc", e.target.value)}
            placeholder="1200,00"
            className="champ mt-1"
          />
        </div>
        <div>
          <label htmlFor="emise-le" className="block font-medium">
            Date d’émission
          </label>
          <input
            id="emise-le"
            type="date"
            value={saisie.emise_le}
            onChange={(e) => modifier("emise_le", e.target.value)}
            className="champ mt-1"
          />
        </div>
        <div>
          <label htmlFor="echeance" className="block font-medium">
            Échéance
          </label>
          <input
            id="echeance"
            type="date"
            value={saisie.echeance}
            onChange={(e) => modifier("echeance", e.target.value)}
            className="champ mt-1"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!formulaireValide || chargement}
        className="btn btn-primaire"
      >
        {chargement
          ? "Enregistrement…"
          : validation
            ? "Valider la facture"
            : facture
              ? "Enregistrer"
              : "Créer la facture"}
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
