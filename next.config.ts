import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Jeton d'envoi des source maps, utilisé uniquement pendant la construction
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Les erreurs du navigateur transitent par l'application : les bloqueurs de publicité ne les arrêtent pas
  tunnelRoute: "/monitoring",
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
