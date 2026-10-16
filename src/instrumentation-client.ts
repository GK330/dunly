import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "local",
  // Toutes les traces en local, une sur dix en production pour préserver le quota
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  // Limite les données collectées au strict nécessaire au débogage
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpBodies: [],
    stackFrameVariables: false,
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
