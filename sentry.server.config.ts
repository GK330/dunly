import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "local",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpBodies: [],
    stackFrameVariables: false,
  },
});
