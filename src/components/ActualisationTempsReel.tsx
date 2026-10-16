"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { creerClientNavigateur } from "@/lib/supabase/client";

type Props = {
  userId: string;
  tables: string[];
};

// S'abonne aux changements des lignes de l'utilisateur et rafraîchit la page serveur :
// le tableau se met à jour sans rechargement, sans interroger le serveur en boucle
export default function ActualisationTempsReel({ userId, tables }: Props) {
  const router = useRouter();
  const cleTables = tables.join(",");

  useEffect(() => {
    const supabase = creerClientNavigateur();
    let canal: RealtimeChannel | null = null;
    let actif = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;

    // Plusieurs événements rapprochés ne provoquent qu'un seul rafraîchissement
    function rafraichir() {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => router.refresh(), 300);
    }

    // Charge la session : l'abonnement doit être fait au nom de l'utilisateur,
    // pour que la Row Level Security autorise la réception des événements
    supabase.auth.getSession().then(() => {
      if (!actif) return;

      canal = supabase.channel(`maj-${userId}-${cleTables}`);
      for (const table of cleTables.split(",")) {
        canal.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
          rafraichir
        );
      }
      canal.subscribe();
    });

    return () => {
      actif = false;
      clearTimeout(minuteur);
      if (canal) supabase.removeChannel(canal);
    };
  }, [userId, cleTables, router]);

  return null;
}
