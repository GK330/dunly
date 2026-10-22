import type { MetadataRoute } from "next";

// Manifeste de l'application (ajout à l'écran d'accueil sur mobile)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dunly",
    short_name: "Dunly",
    description: "L'outil anti-impayés des indépendants : relances automatiques et suivi des encaissements.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#FF6A00",
    icons: [
      {
        src: "/dunly-logo-favicons/favicon/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/dunly-logo-favicons/favicon/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
