import Image from "next/image";
import {
  CheckCircle,
  Clock,
  LinkBreak,
  LockSimple,
  ProhibitInset,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { ETATS_PAIEMENT, type EtatPaiement } from "@/lib/stripe";

const MESSAGES: Record<
  EtatPaiement,
  { titre: string; texte: string; classes: string; icone: Icon }
> = {
  merci: {
    titre: "Merci pour votre paiement",
    texte:
      "Votre paiement est en cours de confirmation par Stripe. La facture sera marquée comme réglée automatiquement et vous ne recevrez plus de relance.",
    classes: "alerte-succes",
    icone: CheckCircle,
  },
  annule: {
    titre: "Paiement annulé",
    texte:
      "Aucun montant n’a été débité. Vous pouvez réessayer à tout moment depuis le lien reçu par e-mail.",
    classes: "alerte-attente",
    icone: XCircle,
  },
  "deja-reglee": {
    titre: "Facture déjà réglée",
    texte: "Cette facture est déjà enregistrée comme payée. Merci !",
    classes: "alerte-succes",
    icone: CheckCircle,
  },
  indisponible: {
    titre: "Paiement par carte indisponible",
    texte:
      "Le paiement par carte n’est pas proposé pour cette facture. Merci de contacter directement son émetteur.",
    classes: "alerte-info",
    icone: ProhibitInset,
  },
  introuvable: {
    titre: "Lien de paiement invalide",
    texte: "Ce lien ne correspond à aucune facture. Vérifiez l’adresse reçue par e-mail.",
    classes: "alerte-erreur",
    icone: LinkBreak,
  },
  "trop-de-tentatives": {
    titre: "Trop de tentatives",
    texte: "Ce lien a été ouvert trop souvent en peu de temps. Réessayez dans une heure.",
    classes: "alerte-attente",
    icone: Clock,
  },
  erreur: {
    titre: "Paiement momentanément indisponible",
    texte: "Le service de paiement ne répond pas. Réessayez dans quelques minutes.",
    classes: "alerte-erreur",
    icone: WarningCircle,
  },
};

// Page publique, affichée au client après le lien de paiement
export default async function Paiement({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string }>;
}) {
  const { etat } = await searchParams;
  const etatConnu = ETATS_PAIEMENT.find((e) => e === etat) ?? "introuvable";
  const message = MESSAGES[etatConnu];
  const Icone = message.icone;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Image
          src="/dunly-logo-favicons/dunly-logo.svg"
          alt="Dunly"
          width={1260}
          height={345}
          priority
          unoptimized
          className="mx-auto h-10 w-auto"
        />

        <div className={`alerte mt-8 p-6 ${message.classes}`}>
          <Icone size={36} weight="duotone" aria-hidden />
          <h1 className="mt-3 font-titre text-2xl font-bold">{message.titre}</h1>
          <p className="mt-2">{message.texte}</p>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-stone-500">
          <LockSimple size={16} weight="duotone" aria-hidden />
          Paiement sécurisé par Stripe · mode test
        </p>
      </div>
    </main>
  );
}
