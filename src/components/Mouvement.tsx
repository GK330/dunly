"use client";

import { MotionConfig } from "motion/react";

// Les animations respectent le réglage « réduire les animations » du système
export default function Mouvement({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
