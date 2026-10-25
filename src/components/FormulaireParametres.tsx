"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Props = {
  parametres: {
    nom_affiche: string;
    signature: string;
    taux_cotisations: number;
    validation_relances: boolean;
    paiement_carte_actif: boolean;
  };
};

export default function FormulaireParametres({ parametres }: Props) {
  const router = useRouter();
  const [nomAffiche, setNomAffiche] = useState(parametres.nom_affiche);
  const [signature, setSignature] = useState(parametres.signature);
  const [taux, setTaux] = useState(
    String(Math.round(parametres.taux_cotisations * 10000) / 100).replace(".", ",")
  );
  const [validationRelances, setValidationRelances] = useState(parametres.validation_relances);
  const [paiementCarte, setPaiementCarte] = useState(parametres.paiement_carte_actif);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setChargement(true);
    setErreur("");

    try {
      const reponse = await fetch("/api/parametres", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom_affiche: nomAffiche,
          signature,
          taux_cotisations: taux,
          validation_relances: validationRelances,
          paiement_carte_actif: paiementCarte,
        }),
      });
      const donnees = await reponse.json();

      if (!reponse.ok) {
        setErreur(donnees.erreur ?? "Une erreur est survenue.");
        return;
      }

      toast.success("Paramètres enregistrés.");
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

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Relances</legend>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={validationRelances}
            onChange={(e) => setValidationRelances(e.target.checked)}
            className="mt-1 size-4 accent-mandarine"
          />
          <span>
            Valider chaque relance avant son envoi
            <span className="block text-sm text-stone-500">
              Activé : rien ne part sans votre validation. Désactivé : la relance part
              automatiquement le jour prévu, après l’e-mail qui vous prévient.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={paiementCarte}
            onChange={(e) => setPaiementCarte(e.target.checked)}
            className="mt-1 size-4 accent-mandarine"
          />
          <span>
            Proposer le paiement par carte dans les relances
            <span className="block text-sm text-stone-500">
              Un lien de paiement Stripe est ajouté à chaque relance. Désactivez-le si vous ne
              souhaitez pas payer les frais de Stripe.
            </span>
          </span>
        </label>
      </fieldset>

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
    </form>
  );
}
