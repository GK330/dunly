"use client";

import { motion } from "motion/react";

// Fait apparaître une section en douceur quand elle entre à l'écran
export default function Apparition({
  children,
  delai = 0,
  className,
}: {
  children: React.ReactNode;
  delai?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: delai, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
