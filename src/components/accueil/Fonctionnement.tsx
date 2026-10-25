"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import {
  Bell,
  ChatCircleText,
  CheckCircle,
  CreditCard,
  FilePdf,
  PaperPlaneTilt,
  PauseCircle,
  Sparkle,
  UploadSimple,
} from "@phosphor-icons/react";

const RESSORT = { type: "spring", stiffness: 160, damping: 16 } as const;

// Rejoue une scène en boucle : la clé change toutes les `duree` millisecondes
function useBoucle(duree: number) {
  const [tour, setTour] = useState(0);
  useEffect(() => {
    const minuterie = setInterval(() => setTour((t) => t + 1), duree);
    return () => clearInterval(minuterie);
  }, [duree]);
  return tour;
}

function Apparait({
  delai,
  children,
  className,
}: {
  delai: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...RESSORT, delay: delai }}
    >
      {children}
    </motion.div>
  );
}

// 1. Le PDF tombe dans la zone de dépôt, la barre se remplit
function SceneDepot() {
  const tour = useBoucle(5200);
  return (
    <div key={tour} className="flex h-full flex-col items-center justify-center gap-5">
      <div className="relative flex h-52 w-full max-w-xs flex-col items-center justify-center rounded-3xl border-2 border-dashed border-mandarine/45 bg-abricot/40">
        <UploadSimple weight="duotone" className="size-8 text-mandarine/60" aria-hidden />
        <p className="mt-2 text-sm text-brun">Déposez vos factures ici</p>
        <motion.div
          className="absolute flex items-center gap-3 rounded-2xl border border-grege bg-white px-4 py-3 shadow-lg"
          initial={{ y: -190, rotate: -14, opacity: 0 }}
          animate={{ y: 0, rotate: -3, opacity: 1 }}
          transition={{ type: "spring", stiffness: 110, damping: 11, delay: 0.3 }}
        >
          <FilePdf weight="duotone" className="size-8 text-red-600" aria-hidden />
          <div>
            <p className="font-mono text-sm font-medium">F2026-042.pdf</p>
            <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-grege">
              <motion.div
                className="h-full rounded-full bg-mandarine"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.2, delay: 1.1, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      </div>
      <Apparait delai={2.4} className="flex items-center gap-2 text-sm font-medium text-emerald-700">
        <CheckCircle weight="duotone" className="size-5" aria-hidden /> Facture déposée
      </Apparait>
    </div>
  );
}

const CHAMPS = [
  ["Client", "Boulangerie Les Trois Épis"],
  ["Montant TTC", "800,00 €"],
  ["Échéance", "01/10/2026"],
];

// 2. Un faisceau parcourt la facture, les champs relevés apparaissent un à un
function SceneLecture() {
  const tour = useBoucle(6000);
  return (
    <div key={tour} className="flex h-full flex-col items-center justify-center gap-5 sm:flex-row">
      <div className="relative h-56 w-40 shrink-0 overflow-hidden rounded-xl border border-grege bg-white p-4 shadow-md">
        <div className="h-2 w-16 rounded bg-cacao/70" />
        <div className="mt-4 space-y-2">
          {[90, 70, 80, 55, 85, 60, 75].map((largeur, index) => (
            <div key={index} className="h-1.5 rounded bg-grege" style={{ width: `${largeur}%` }} />
          ))}
        </div>
        <div className="mt-5 ml-auto h-2.5 w-14 rounded bg-mandarine/60" />
        <motion.div
          aria-hidden
          className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-mandarine/25 to-transparent"
          initial={{ top: "-20%" }}
          animate={{ top: ["-20%", "100%", "-20%"] }}
          transition={{ duration: 2.4, ease: "easeInOut", repeat: 1 }}
        />
      </div>
      <div className="w-full max-w-60 space-y-2">
        <Apparait delai={0.4} className="flex items-center gap-1.5 text-xs font-semibold text-mandarine-fonce">
          <Sparkle weight="duotone" className="size-4" aria-hidden /> Lecture par l’IA
        </Apparait>
        {CHAMPS.map(([libelle, valeur], index) => (
          <Apparait key={libelle} delai={0.9 + index * 0.55} className="rounded-xl border border-grege bg-white px-3 py-2">
            <p className="text-xs text-brun">{libelle}</p>
            <p className="text-sm font-medium">{valeur}</p>
          </Apparait>
        ))}
        <Apparait delai={2.8}>
          <span className="inline-block rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
            En retard · 22 j
          </span>
        </Apparait>
      </div>
    </div>
  );
}

// 3. La notification arrive, le texte s'écrit, le bouton est pressé, l'avion décolle
function SceneRelance() {
  const tour = useBoucle(6500);
  return (
    <div key={tour} className="flex h-full flex-col items-center justify-center gap-4">
      <motion.div
        className="flex w-full max-w-xs items-center gap-3 rounded-2xl border border-grege bg-white/90 px-4 py-3 shadow-lg backdrop-blur"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...RESSORT, delay: 0.2 }}
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-abricot text-mandarine-fonce">
          <Bell weight="duotone" className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-brun">Dunly · à l’instant</p>
          <p className="truncate text-sm font-medium">Relance prête : facture F2026-042</p>
        </div>
      </motion.div>

      <div className="w-full max-w-xs rounded-2xl border border-grege bg-white p-4 shadow-md">
        <p className="text-xs text-brun">Objet : Rappel · facture n° F2026-042</p>
        <div className="mt-3 space-y-2">
          {[100, 92, 78, 60].map((largeur, index) => (
            <motion.div
              key={index}
              className="h-1.5 rounded bg-grege"
              initial={{ width: "0%" }}
              animate={{ width: `${largeur}%` }}
              transition={{ duration: 0.5, delay: 0.9 + index * 0.35, ease: "easeOut" }}
            />
          ))}
        </div>
        <div className="relative mt-4 flex justify-end">
          <motion.span
            className="btn btn-primaire px-3 py-1.5 text-sm"
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1, 0.92, 1] }}
            transition={{ duration: 0.5, delay: 2.9, times: [0, 0.4, 0.7, 1] }}
          >
            Valider et envoyer
          </motion.span>
          <motion.span
            aria-hidden
            className="absolute right-2 bottom-1 text-mandarine"
            initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x: [0, 30, 110, 170], y: [0, -30, -110, -170], rotate: [0, 10, 20, 25] }}
            transition={{ duration: 1.4, delay: 3.3, ease: "easeIn" }}
          >
            <PaperPlaneTilt weight="duotone" className="size-7" />
          </motion.span>
        </div>
      </div>
      <Apparait delai={4.2} className="flex items-center gap-2 text-sm font-medium text-emerald-700">
        <CheckCircle weight="duotone" className="size-5" aria-hidden /> Relance envoyée
      </Apparait>
    </div>
  );
}

const CARTE = "4242 4242 4242 4242";

// 4. Le numéro de carte se tape, puis le tampon « Payée » s'abat
function ScenePaiement() {
  const tour = useBoucle(6500);
  return (
    <div key={tour} className="flex h-full items-center justify-center">
      <div className="relative w-full max-w-xs rounded-2xl border border-grege bg-white p-5 shadow-md">
        <p className="text-xs text-brun">Facture n° F2026-042</p>
        <p className="font-titre text-3xl font-bold">800,00 €</p>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-grege px-3 py-2.5 font-mono text-sm">
          <CreditCard weight="duotone" className="size-5 shrink-0 text-brun" aria-hidden />
          <span>
            {Array.from(CARTE).map((chiffre, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + index * 0.07, duration: 0.01 }}
              >
                {chiffre}
              </motion.span>
            ))}
          </span>
        </div>
        <motion.div
          className="btn btn-primaire mt-4 w-full"
          animate={{ scale: [1, 1, 0.95, 1] }}
          transition={{ duration: 0.5, delay: 2, times: [0, 0.4, 0.7, 1] }}
        >
          Payer 800,00 €
        </motion.div>
        <p className="mt-3 text-center text-xs text-brun">Paiement sécurisé par Stripe</p>

        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 2.4, rotate: -24 }}
          animate={{ opacity: 1, scale: 1, rotate: -12 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 2.7 }}
        >
          <span className="rounded-xl border-4 border-emerald-600 bg-white/85 px-5 py-1.5 font-titre text-3xl font-black tracking-widest text-emerald-600 uppercase backdrop-blur-sm">
            Payée
          </span>
        </motion.div>
      </div>
    </div>
  );
}

// 5. La réponse du client arrive, l'IA la classe, les relances se mettent en pause
function SceneReponses() {
  const tour = useBoucle(6000);
  return (
    <div key={tour} className="flex h-full flex-col justify-center gap-4 px-2">
      <Apparait delai={0.3} className="max-w-[85%] self-start rounded-2xl rounded-bl-md border border-grege bg-white px-4 py-3 shadow-sm">
        <p className="text-xs text-brun">Boulangerie Les Trois Épis</p>
        <p className="mt-1 text-sm">Bonjour, je vous règle la facture le 20 novembre. Désolé pour le retard !</p>
      </Apparait>
      <Apparait delai={1.4} className="flex items-center gap-2 self-center text-xs font-semibold text-mandarine-fonce">
        <Sparkle weight="duotone" className="size-4" aria-hidden /> Réponse lue par l’IA
      </Apparait>
      <Apparait delai={2} className="self-end">
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
          <ChatCircleText weight="duotone" className="size-4" aria-hidden /> Promesse de paiement · 20/11
        </span>
      </Apparait>
      <Apparait delai={2.8} className="self-end rounded-2xl border border-grege bg-white px-4 py-3 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium">
          <PauseCircle weight="duotone" className="size-5 text-mandarine" aria-hidden />
          Relances en pause jusqu’au 22/11
        </p>
      </Apparait>
    </div>
  );
}

const ETAPES = [
  {
    titre: "Déposez vos factures",
    texte: "Glissez vos PDF, jusqu’à cinq à la fois. Aucune saisie : Dunly s’occupe de la lecture.",
    Scene: SceneDepot,
  },
  {
    titre: "L’IA lit et repère les retards",
    texte:
      "Client, montant, échéance : tout est relevé puis vérifié. Les retards sont calculés par Dunly, jamais devinés.",
    Scene: SceneLecture,
  },
  {
    titre: "Une relance prête, vous validez",
    texte:
      "Dès le 3ᵉ jour de retard, une relance adaptée au client est rédigée. Un e-mail vous prévient, vous l’envoyez d’un clic.",
    Scene: SceneRelance,
  },
  {
    titre: "Votre client paie par carte",
    texte:
      "Chaque relance contient un lien de paiement sécurisé par Stripe. La facture passe en payée toute seule.",
    Scene: ScenePaiement,
  },
  {
    titre: "Ses réponses sont lues pour vous",
    texte:
      "« Je paie le 20 », « déjà réglé », « je conteste » : la réponse est classée, et les relances s’adaptent.",
    Scene: SceneReponses,
  },
];

function CadreScene({ children }: { children: React.ReactNode }) {
  return (
    <div className="carte overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-grege bg-papier px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-grege" />
        <span className="size-2.5 rounded-full bg-grege" />
        <span className="size-2.5 rounded-full bg-grege" />
        <span className="ml-3 font-mono text-xs text-brun">dunly.app</span>
      </div>
      <div className="relative h-[360px] bg-[radial-gradient(circle_at_50%_40%,var(--color-abricot)_0%,transparent_65%)] p-6 lg:h-[420px]">
        {children}
      </div>
    </div>
  );
}

// Sur mobile, chaque scène s'affiche sous son étape et ne démarre qu'une fois visible
function SceneMobile({ Scene }: { Scene: () => React.ReactElement }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, margin: "-20% 0px" });
  return (
    <div ref={ref} className="mt-6 lg:hidden">
      <CadreScene>{visible && <Scene />}</CadreScene>
    </div>
  );
}

// « Comment ça marche » : en faisant défiler les étapes, la scène animée suit
export default function Fonctionnement() {
  const [actif, setActif] = useState(0);
  const SceneActive = ETAPES[actif].Scene;

  return (
    <div className="mt-6 grid gap-x-14 lg:grid-cols-2">
      <ol>
        {ETAPES.map((etape, index) => (
          <motion.li
            key={etape.titre}
            onViewportEnter={() => setActif(index)}
            viewport={{ margin: "-50% 0px -50% 0px" }}
            className="flex flex-col justify-center py-10 lg:min-h-[75vh]"
          >
            <div
              className={`transition-opacity duration-500 ${
                actif === index ? "lg:opacity-100" : "lg:opacity-35"
              }`}
            >
              <span className="flex size-11 items-center justify-center rounded-2xl bg-abricot font-mono text-lg font-semibold text-mandarine-fonce">
                {index + 1}
              </span>
              <h3 className="mt-5 font-titre text-2xl font-bold tracking-tight sm:text-3xl">
                {etape.titre}
              </h3>
              <p className="mt-3 max-w-md text-lg text-brun">{etape.texte}</p>
            </div>
            <SceneMobile Scene={etape.Scene} />
          </motion.li>
        ))}
      </ol>

      <div className="hidden lg:block">
        <div className="sticky top-[calc(50vh-235px)]">
          <CadreScene>
            <AnimatePresence mode="wait">
              <motion.div
                key={actif}
                className="h-full"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <SceneActive />
              </motion.div>
            </AnimatePresence>
          </CadreScene>
          <div className="mt-4 flex justify-center gap-2" aria-hidden>
            {ETAPES.map((etape, index) => (
              <motion.span
                key={etape.titre}
                className="h-1.5 rounded-full"
                animate={{
                  width: actif === index ? 28 : 8,
                  backgroundColor: actif === index ? "#f0611d" : "#eadfd4",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
