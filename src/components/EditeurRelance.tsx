"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowCounterClockwise, Plus, Warning } from "@phosphor-icons/react";
import { echapperHtml } from "@/lib/html";
import {
  BALISES,
  composerEmailRelance,
  LIBELLES_BALISES,
  verifierSaisie,
  type Balise,
  type NiveauRelance,
  type ValeursRelance,
} from "@/lib/relances";

type Props = {
  relanceId: string;
  contenu: string;
  niveau: NiveauRelance;
  valeurs: ValeursRelance;
  lienPaiement: string | null;
  signature: string;
  origine: string | null;
  actions: React.ReactNode;
};

const CLASSES_PASTILLE =
  "mx-0.5 inline-block cursor-default rounded-md bg-abricot px-1.5 font-medium text-mandarine-fonce ring-1 ring-mandarine/25";

function pastilleHtml(nom: Balise, valeurs: ValeursRelance): string {
  const valeur = valeurs[nom] || LIBELLES_BALISES[nom];
  return `<span data-balise="${nom}" contenteditable="false" class="${CLASSES_PASTILLE}" title="${LIBELLES_BALISES[nom]} : rempli automatiquement depuis la facture">${echapperHtml(valeur)}</span>`;
}

// Texte stocké (avec {{balises}}) → contenu de l'éditeur (avec pastilles)
function versHtml(texte: string, valeurs: ValeursRelance): string {
  return echapperHtml(texte).replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (balise, nom: string) =>
    (BALISES as readonly string[]).includes(nom) ? pastilleHtml(nom as Balise, valeurs) : balise
  );
}

// Contenu de l'éditeur → texte stocké : chaque pastille redevient sa balise
function versTexte(noeud: Node): string {
  let texte = "";
  noeud.childNodes.forEach((enfant) => {
    if (enfant.nodeType === Node.TEXT_NODE) {
      texte += enfant.nodeValue ?? "";
    } else if (enfant instanceof HTMLElement) {
      if (enfant.dataset.balise) texte += `{{${enfant.dataset.balise}}}`;
      else if (enfant.tagName === "BR") texte += "\n";
      else texte += (enfant.tagName === "DIV" || enfant.tagName === "P" ? "\n" : "") + versTexte(enfant);
    }
  });
  return texte.replace(/​/g, "");
}

// Corps de la relance : les valeurs de la facture sont des pastilles insécables, l'aperçu suit la frappe
export default function EditeurRelance({
  relanceId,
  contenu,
  niveau,
  valeurs,
  lienPaiement,
  signature,
  origine,
  actions,
}: Props) {
  const router = useRouter();
  const editeur = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const [texte, setTexte] = useState(contenu);
  const [chargement, setChargement] = useState(false);

  // Contenu injecté une seule fois : une actualisation de la page n'efface pas la saisie en cours.
  // Après un enregistrement, la clé du composant change et il est remonté avec le nouveau texte.
  const initial = useRef({ contenu, valeurs });

  function afficher(valeur: string) {
    if (editeur.current) editeur.current.innerHTML = versHtml(valeur, valeurs);
  }

  useEffect(() => {
    if (editeur.current) {
      editeur.current.innerHTML = versHtml(initial.current.contenu, initial.current.valeurs);
    }
  }, []);

  // Position du curseur dans l'éditeur, pour y insérer une pastille depuis la barre d'outils
  useEffect(() => {
    function memoriser() {
      const courante = window.getSelection();
      if (courante?.rangeCount && editeur.current?.contains(courante.anchorNode)) {
        selection.current = courante.getRangeAt(0).cloneRange();
      }
    }
    document.addEventListener("selectionchange", memoriser);
    return () => document.removeEventListener("selectionchange", memoriser);
  }, []);

  function lire() {
    if (editeur.current) setTexte(versTexte(editeur.current));
  }

  // Une balise tapée à la main ({{montant}}) devient une pastille en quittant l'éditeur
  function normaliser() {
    const zone = editeur.current;
    if (!zone) return;
    const parcours = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
    for (let noeud = parcours.nextNode(); noeud; noeud = parcours.nextNode()) {
      if (/\{\{\s*[a-z_]+\s*\}\}/.test(noeud.nodeValue ?? "")) {
        afficher(versTexte(zone));
        return;
      }
    }
  }

  function inserer(nom: Balise) {
    const zone = editeur.current;
    if (!zone) return;

    let plage = selection.current;
    if (!plage || !zone.contains(plage.startContainer)) {
      plage = document.createRange();
      plage.selectNodeContents(zone);
      plage.collapse(false);
    }

    const gabarit = document.createElement("template");
    gabarit.innerHTML = pastilleHtml(nom, valeurs);
    const pastille = gabarit.content.firstChild as Node;
    const espace = document.createTextNode(" ");

    plage.deleteContents();
    plage.insertNode(espace);
    plage.insertNode(pastille);
    plage.setStartAfter(espace);
    plage.collapse(true);

    const courante = window.getSelection();
    courante?.removeAllRanges();
    courante?.addRange(plage);
    zone.focus();
    lire();
  }

  function annuler() {
    setTexte(contenu);
    afficher(contenu);
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setChargement(true);

    try {
      const reponse = await fetch(`/api/relances/${relanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenu: texte }),
      });
      const donnees = await reponse.json();

      if (!reponse.ok) {
        toast.error(donnees.erreur ?? "Une erreur est survenue.");
        return;
      }

      toast.success("Texte enregistré.");
      router.refresh();
    } catch {
      toast.error("Impossible de contacter le serveur.");
    } finally {
      setChargement(false);
    }
  }

  const { erreurs, avertissements } = verifierSaisie(texte);
  const modifie = texte.trim() !== contenu.trim();
  const apercu = composerEmailRelance({ niveau, corps: texte, valeurs, lienPaiement, signature });

  return (
    <div className="mt-6 grid gap-8 md:grid-cols-2">
      <section className="min-w-0">
        <h2 className="font-titre text-lg font-semibold">Aperçu de l’e-mail</h2>
        <p className="text-sm text-stone-500">
          {modifie ? "Aperçu de vos modifications, non enregistrées" : origine}
        </p>
        <div className="mt-3 carte p-5 text-sm">
          <p className="font-medium">Objet : {apercu.sujet}</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans [overflow-wrap:anywhere] text-stone-800">
            {apercu.texte}
          </pre>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-4">
        {actions}

        <form onSubmit={enregistrer} className="flex flex-col gap-3">
          <label id="corps-relance" className="font-medium">
            Corps du message
          </label>

          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-stone-500">Insérer :</span>
            {BALISES.map((nom) => (
              <button
                key={nom}
                type="button"
                // La sélection reste dans l'éditeur : la pastille arrive à l'endroit du curseur
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => inserer(nom)}
                className="inline-flex items-center gap-1 rounded-md border border-grege bg-white px-2 py-1 text-brun transition hover:border-mandarine/40 hover:bg-abricot/50 hover:text-mandarine-fonce"
              >
                <Plus weight="bold" className="size-3" aria-hidden />
                {LIBELLES_BALISES[nom]}
              </button>
            ))}
          </div>

          <div
            ref={editeur}
            role="textbox"
            aria-multiline="true"
            aria-labelledby="corps-relance"
            contentEditable="plaintext-only"
            suppressContentEditableWarning
            spellCheck
            onInput={lire}
            onBlur={normaliser}
            className="champ min-h-56 whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]"
          />

          <p className="text-sm text-stone-500">
            Les pastilles orange affichent les vraies valeurs de la facture : on ne peut pas les
            modifier, seulement les supprimer ou en insérer. La formule d’appel, le récapitulatif,
            le lien de paiement, les mentions légales et la signature sont ajoutés par Dunly.
          </p>

          {[...erreurs, ...avertissements].map((message) => (
            <p
              key={message}
              className={`alerte flex items-start gap-2 ${erreurs.includes(message) ? "alerte-erreur" : "alerte-attente"}`}
            >
              <Warning weight="duotone" className="mt-0.5 size-4 shrink-0" aria-hidden />
              {message}
            </p>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={chargement || !modifie || erreurs.length > 0}
              className="btn btn-primaire"
            >
              {chargement ? "Enregistrement…" : "Enregistrer le texte"}
            </button>
            {modifie && (
              <button type="button" onClick={annuler} className="btn btn-secondaire">
                <ArrowCounterClockwise weight="bold" className="size-4" aria-hidden />
                Annuler mes modifications
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
