"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function SentryUtilisateur({ id }: { id: string }) {
  useEffect(() => {
    Sentry.setUser({ id });
    return () => Sentry.setUser(null);
  }, [id]);

  return null;
}
