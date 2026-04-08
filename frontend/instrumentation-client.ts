import * as Sentry from "@sentry/nextjs";
import { getBrowserSentryOptions } from "./sentry.shared";

Sentry.init(getBrowserSentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
