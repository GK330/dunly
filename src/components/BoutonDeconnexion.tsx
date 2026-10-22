"use client";

import { useRouter } from "next/navigation";
import { SignOut } from "@phosphor-icons/react";
import { creerClientNavigateur } from "@/lib/supabase/client";

export default function BoutonDeconnexion() {
  const router = useRouter();

  async function deconnecter() {
    await creerClientNavigateur().auth.signOut();
    router.push("/connexion");
    router.refresh();
  }

  return (
    <button
      onClick={deconnecter}
      title="Se déconnecter"
      className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm font-medium text-cacao ring-1 ring-grege transition hover:bg-abricot/60"
    >
      <SignOut weight="duotone" className="size-4" aria-hidden />
      <span className="hidden sm:inline">Se déconnecter</span>
    </button>
  );
}
