"use client";

import { Toaster } from "sonner";

// Toasts de confirmation (Sonner), aux couleurs de Dunly
export default function Notifications() {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border-grege !bg-white !font-sans !text-cacao !shadow-lg",
          description: "!text-brun",
          success: "[&_[data-icon]]:!text-emerald-600",
          error: "[&_[data-icon]]:!text-red-600",
        },
      }}
    />
  );
}
