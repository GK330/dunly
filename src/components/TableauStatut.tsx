"use client";

import { useCallback, useEffect, useState } from "react";
import type { EntreeHistorique, ResultatControle, Statut } from "@/lib/statut";

type ReponseStatut = {
  verifieLe: string;
  statutGlobal: Statut;
  services: ResultatControle[];
  historique: EntreeHistorique[];
};

const INTERVALLE_MS = 30000;

const AFFICHAGE: Record<Statut, { libelle: string; classes: string; pastille: string }> = {
  operationnel: {
    libelle: "Opérationnel",
    classes: "bg-green-100 text-green-800",
    pastille: "bg-green-500",
  },
  degrade: {
    libelle: "Dégradé",
    classes: "bg-yellow-100 text-yellow-800",
    pastille: "bg-yellow-400",
  },
  en_panne: {
    libelle: "En panne",
    classes: "bg-red-100 text-red-800",
    pastille: "bg-red-500",
  },
};

const MESSAGE_GLOBAL: Record<Statut, string> = {
  operationnel: "Tous les services sont opérationnels.",
  degrade: "Au moins un service répond lentement.",
  en_panne: "Au moins un service est en panne.",
};

async function recupererStatut(): Promise<ReponseStatut> {
  const reponse = await fetch("/api/admin/statut", { cache: "no-store" });
  if (!reponse.ok) {
    throw new Error(`Statut ${reponse.status}`);
  }
  return reponse.json();
}

function heure(date: string) {
  return new Date(date).toLocaleTimeString("fr-FR");
}

export default function TableauStatut() {
  const [donnees, setDonnees] = useState<ReponseStatut | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [messageTest, setMessageTest] = useState("");
  const [messageEmail, setMessageEmail] = useState("");
  const [automatique, setAutomatique] = useState(true);

  const appliquer = useCallback((promesse: Promise<ReponseStatut>) => {
    promesse
      .then((resultat) => {
        setDonnees(resultat);
        setErreur("");
      })
      .catch(() => setErreur("Impossible de joindre la route de statut."))
      .finally(() => setChargement(false));
  }, []);

  const actualiser = useCallback(() => {
    setChargement(true);
    appliquer(recupererStatut());
  }, [appliquer]);

  // Premier chargement
  useEffect(() => {
    appliquer(recupererStatut());
  }, [appliquer]);

  // Rafraîchissement automatique, uniquement quand la page est visible
  useEffect(() => {
    if (!automatique) return;

    const intervalle = setInterval(() => {
      if (document.visibilityState === "visible") actualiser();
    }, INTERVALLE_MS);

    return () => clearInterval(intervalle);
  }, [automatique, actualiser]);

  async function envoyerErreurTest() {
    setMessageTest("Envoi…");
    const reponse = await fetch("/api/admin/erreur-test", { method: "POST" });
    setMessageTest(
      reponse.status === 500
        ? "Erreur de test envoyée : elle doit apparaître dans Sentry d’ici quelques secondes."
        : `Réponse inattendue (statut ${reponse.status}).`
    );
  }

  async function envoyerEmailTest() {
    setMessageEmail("Envoi…");
    try {
      const reponse = await fetch("/api/admin/email-test", { method: "POST" });
      const donnees = await reponse.json();
      setMessageEmail(donnees.message ?? donnees.erreur ?? `Statut ${reponse.status}`);
    } catch {
      setMessageEmail("Impossible de contacter le serveur.");
    }
  }

  const incidents = donnees?.historique.filter((e) => e.statutGlobal !== "operationnel") ?? [];

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Administration</h1>
        <div className="flex gap-2">
          <button onClick={envoyerErreurTest} className="rounded border px-4 py-2 font-medium">
            Envoyer une erreur de test
          </button>
          <button onClick={envoyerEmailTest} className="rounded border px-4 py-2 font-medium">
            Envoyer un e-mail de test
          </button>
          <button
            onClick={actualiser}
            disabled={chargement}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {chargement ? "Vérification…" : "Relancer les tests"}
          </button>
        </div>
      </div>

      {messageTest && <p className="mt-2 text-sm text-gray-600">{messageTest}</p>}
      {messageEmail && <p className="mt-2 text-sm text-gray-600">{messageEmail}</p>}

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={automatique}
          onChange={(e) => setAutomatique(e.target.checked)}
        />
        Rafraîchissement automatique toutes les {INTERVALLE_MS / 1000} secondes
      </label>

      {erreur && (
        <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-red-700">{erreur}</p>
      )}

      {donnees && (
        <>
          <p
            className={`mt-6 rounded p-3 font-medium ${AFFICHAGE[donnees.statutGlobal].classes}`}
          >
            {MESSAGE_GLOBAL[donnees.statutGlobal]}
          </p>

          <section className="mt-6">
            <h2 className="text-lg font-semibold">Historique des derniers contrôles</h2>
            <p className="text-sm text-gray-500">Du plus récent (à gauche) au plus ancien</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {donnees.historique.map((entree) => (
                <span
                  key={entree.date}
                  title={`${heure(entree.date)} · ${AFFICHAGE[entree.statutGlobal].libelle}${
                    entree.servicesEnPanne.length > 0
                      ? ` · En panne : ${entree.servicesEnPanne.join(", ")}`
                      : ""
                  }`}
                  className={`h-6 w-3 rounded-sm ${AFFICHAGE[entree.statutGlobal].pastille}`}
                />
              ))}
            </div>

            {incidents.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {incidents.slice(0, 5).map((entree) => (
                  <li key={entree.date} className="text-gray-700">
                    <span className="font-medium">{heure(entree.date)}</span> ·{" "}
                    {[...entree.servicesEnPanne, ...entree.servicesDegrades].join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Service</th>
                  <th className="p-2">Statut</th>
                  <th className="p-2">Temps de réponse</th>
                  <th className="p-2">Détail</th>
                </tr>
              </thead>
              <tbody>
                {donnees.services.map((s) => (
                  <tr key={s.service} className="border-b align-top">
                    <td className="p-2">
                      <p className="font-medium">{s.service}</p>
                      <p className="text-gray-500">{s.description}</p>
                    </td>
                    <td className="p-2">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${AFFICHAGE[s.statut].classes}`}
                      >
                        {AFFICHAGE[s.statut].libelle}
                      </span>
                    </td>
                    <td className="p-2">{s.latenceMs} ms</td>
                    <td className="p-2 text-gray-700">{s.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Dernière vérification : {new Date(donnees.verifieLe).toLocaleString("fr-FR")}
          </p>
        </>
      )}
    </main>
  );
}
