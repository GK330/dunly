"use client";

import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { useReducedMotion } from "motion/react";
import { GlobeHemisphereWest } from "@phosphor-icons/react";
import { PARIS, VILLES } from "@/components/accueil/villes";

const MANDARINE: [number, number, number] = [240 / 255, 97 / 255, 29 / 255];

function webglDisponible() {
  try {
    const essai = document.createElement("canvas");
    return Boolean(essai.getContext("webgl2") ?? essai.getContext("webgl"));
  } catch {
    return false;
  }
}

// Globe terrestre en WebGL (cobe) : il tourne seul, et se fait tourner à la souris ou au doigt
export default function Globe({ className }: { className?: string }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const glissement = useRef<{ x: number; y: number } | null>(null);
  const vitesse = useRef(0);
  const angles = useRef({ phi: 4.6, theta: 0.3 });
  const [etat, setEtat] = useState<"chargement" | "pret" | "indisponible">("chargement");
  const reduit = useReducedMotion();

  useEffect(() => {
    const element = conteneur.current;
    if (!element) return;

    if (!webglDisponible()) {
      const image = requestAnimationFrame(() => setEtat("indisponible"));
      return () => cancelAnimationFrame(image);
    }

    // Un canevas neuf à chaque montage : un contexte WebGL déjà détruit ne se réutilise pas
    const canvas = document.createElement("canvas");
    canvas.className = "size-full";
    element.appendChild(canvas);

    let largeur = element.offsetWidth || 480;
    const globe = createGlobe(canvas, {
      // cobe multiplie lui-même la taille par la densité de pixels
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width: largeur,
      height: largeur,
      phi: angles.current.phi,
      theta: angles.current.theta,
      dark: 0,
      diffuse: 1.1,
      mapSamples: 16000,
      mapBrightness: 2.4,
      mapBaseBrightness: 0.04,
      baseColor: [1, 0.97, 0.94],
      markerColor: MANDARINE,
      glowColor: [1, 0.9, 0.82],
      markers: [
        { location: PARIS, size: 0.09 },
        ...VILLES.map((ville) => ({ location: ville.position, size: 0.05 })),
      ],
      arcs: VILLES.map((ville) => ({ from: PARIS, to: ville.position })),
      arcColor: MANDARINE,
      arcWidth: 0.6,
      arcHeight: 0.35,
    });

    const observateur = new ResizeObserver(() => {
      largeur = element.offsetWidth || largeur;
    });
    observateur.observe(element);

    let image = 0;
    function boucle() {
      // Élan après un lancer, puis retour à la rotation automatique
      if (!glissement.current) {
        angles.current.phi += vitesse.current + (reduit ? 0 : 0.0035);
        vitesse.current *= 0.94;
      }
      globe.update({
        phi: angles.current.phi,
        theta: angles.current.theta,
        width: largeur,
        height: largeur,
      });
      image = requestAnimationFrame(boucle);
    }
    image = requestAnimationFrame(() => {
      setEtat("pret");
      boucle();
    });

    return () => {
      cancelAnimationFrame(image);
      observateur.disconnect();
      globe.destroy();
      // cobe enveloppe le canevas dans sa propre div : on retire tout
      element.replaceChildren();
    };
  }, [reduit]);

  function demarrer(evenement: React.PointerEvent<HTMLDivElement>) {
    glissement.current = { x: evenement.clientX, y: evenement.clientY };
    vitesse.current = 0;
    evenement.currentTarget.setPointerCapture(evenement.pointerId);
  }

  function deplacer(evenement: React.PointerEvent<HTMLDivElement>) {
    if (!glissement.current) return;
    const dx = evenement.clientX - glissement.current.x;
    const dy = evenement.clientY - glissement.current.y;
    glissement.current = { x: evenement.clientX, y: evenement.clientY };

    angles.current.phi += dx * 0.008;
    angles.current.theta = Math.max(-0.5, Math.min(0.9, angles.current.theta + dy * 0.004));
    vitesse.current = dx * 0.008;
  }

  function arreter() {
    glissement.current = null;
  }

  if (etat === "indisponible") {
    // Navigateur sans WebGL : un globe dessiné à la place
    return (
      <div className={`relative flex aspect-square items-center justify-center ${className ?? ""}`}>
        <div className="flex size-4/5 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,white,var(--color-abricot)_70%)] shadow-[0_30px_80px_-30px_rgb(240_97_29/0.5)]">
          <GlobeHemisphereWest weight="duotone" className="size-1/2 text-mandarine" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={conteneur}
      role="img"
      aria-label="Globe terrestre : Dunly fonctionne partout dans le monde. Faites-le tourner."
      onPointerDown={demarrer}
      onPointerMove={deplacer}
      onPointerUp={arreter}
      onPointerCancel={arreter}
      className={`relative aspect-square w-full cursor-grab touch-pan-y transition-opacity duration-1000 active:cursor-grabbing ${
        etat === "pret" ? "opacity-100" : "opacity-0"
      } ${className ?? ""}`}
    />
  );
}
