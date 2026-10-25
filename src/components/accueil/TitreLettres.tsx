"use client";

import { motion } from "motion/react";

// Grand titre dont les lettres sortent de la page une à une et montent en place.
// Chaque lettre est masquée par sa propre fenêtre (overflow-hidden) : elle « émerge ».
export default function TitreLettres({ texte, className }: { texte: string; className?: string }) {
  const lettres = Array.from(texte);

  return (
    <h1 aria-label={texte} className={className}>
      {lettres.map((lettre, index) => (
        <span
          key={index}
          aria-hidden
          className="-mb-[0.2em] inline-block overflow-hidden px-[0.02em] pb-[0.2em] align-bottom [perspective:600px]"
        >
          <motion.span
            className="inline-block origin-bottom"
            initial={{ y: "115%", rotateX: -70, opacity: 0 }}
            animate={{ y: "0%", rotateX: 0, opacity: 1 }}
            whileHover={{ y: "-6%", transition: { type: "spring", stiffness: 400, damping: 12 } }}
            transition={{
              delay: 0.2 + index * 0.09,
              type: "spring",
              stiffness: 120,
              damping: 15,
              mass: 0.9,
            }}
          >
            {lettre}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}
