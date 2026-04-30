import dotenv from "dotenv"
import { existsSync } from "fs"
import path from "path"

const envPathCandidates = [
  // src mode: backend/src/config -> backend/.env
  path.resolve(__dirname, "../../.env"),
  // dist mode: backend/dist/src/config -> backend/.env
  path.resolve(__dirname, "../../../.env"),
  // launched from backend directory
  path.resolve(process.cwd(), ".env"),
  // launched from repo root
  path.resolve(process.cwd(), "backend/.env"),
]

const resolvedEnvPath = envPathCandidates.find((p) => existsSync(p))
if (resolvedEnvPath) {
  dotenv.config({ path: resolvedEnvPath })
} else {
  dotenv.config()
}

const storageDriver = (
  process.env.STORAGE_DRIVER ?? "local"
) as "local" | "s3" | "supabase"
const isSupabaseStorage = storageDriver === "supabase"

function resolveObjectStorageValue(args: {
  supabaseEnv: string
  genericEnv: string
  fallback: string
}) {
  if (isSupabaseStorage) {
    return (
      process.env[args.supabaseEnv] ??
      process.env[args.genericEnv] ??
      args.fallback
    )
  }

  return process.env[args.genericEnv] ?? args.fallback
}

function parseOriginList(rawValue: string | undefined, envName: string) {
  const origins = String(rawValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  if (origins.length === 0) {
    throw new Error(`Missing allowed origins in ${envName}`)
  }

  for (const origin of origins) {
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error(`Invalid origin configured in ${envName}: ${origin}`)
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Unsupported origin protocol in ${envName}: ${origin}`)
    }

    if (parsed.origin !== origin) {
      throw new Error(`Origin must not include a path in ${envName}: ${origin}`)
    }
  }

  return [...new Set(origins)]
}

export const env = {
  PORT: process.env.PORT || 8080,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "",
  JWT_ACCESS_TTL_MINUTES: Number(process.env.JWT_ACCESS_TTL_MINUTES ?? "15"),
  JWT_REFRESH_TTL_DAYS: Number(process.env.JWT_REFRESH_TTL_DAYS ?? "7"),
  EMAIL_VERIFICATION_REQUIRED:
    (process.env.EMAIL_VERIFICATION_REQUIRED ?? "false") === "true",
  EMAIL_VERIFICATION_TTL_HOURS: Number(
    process.env.EMAIL_VERIFICATION_TTL_HOURS ?? "24",
  ),
  PASSWORD_RESET_TTL_HOURS: Number(
    process.env.PASSWORD_RESET_TTL_HOURS ?? "1",
  ),
  NODE_ENV: process.env.NODE_ENV || "development",
  COOKIE_SECRET: process.env.COOKIE_SECRET ?? "",
  COOKIE_SECURE:
    (process.env.COOKIE_SECURE ??
      (process.env.NODE_ENV === "production" ? "true" : "false")) === "true",
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  FRONTEND_URL: process.env.FRONTEND_URL || "http://127.0.0.1:3000",
  CORS_ORIGINS: parseOriginList(
    process.env.CORS_ORIGINS ?? "http://127.0.0.1:3000",
    "CORS_ORIGINS",
  ),
  CORS_ALLOW_NO_ORIGIN_PATHS: (
    process.env.CORS_ALLOW_NO_ORIGIN_PATHS ??
    "/health,/ready,/api/v1/billing/payfast/notify,/api/v1/payouts/webhook"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),

  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",

  STORAGE_DRIVER: storageDriver,
  LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH ?? "./storage",
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB ?? "20"),

  S3_REGION: resolveObjectStorageValue({
    supabaseEnv: "SUPABASE_S3_REGION",
    genericEnv: "S3_REGION",
    fallback: "auto",
  }),
  S3_ENDPOINT: resolveObjectStorageValue({
    supabaseEnv: "SUPABASE_S3_ENDPOINT",
    genericEnv: "S3_ENDPOINT",
    fallback: "",
  }),
  S3_BUCKET: resolveObjectStorageValue({
    supabaseEnv: "SUPABASE_S3_BUCKET",
    genericEnv: "S3_BUCKET",
    fallback: "",
  }),
  S3_ACCESS_KEY_ID: resolveObjectStorageValue({
    supabaseEnv: "SUPABASE_S3_ACCESS_KEY_ID",
    genericEnv: "S3_ACCESS_KEY_ID",
    fallback: "",
  }),
  S3_SECRET_ACCESS_KEY: resolveObjectStorageValue({
    supabaseEnv: "SUPABASE_S3_SECRET_ACCESS_KEY",
    genericEnv: "S3_SECRET_ACCESS_KEY",
    fallback: "",
  }),
  S3_FORCE_PATH_STYLE:
    resolveObjectStorageValue({
      supabaseEnv: "SUPABASE_S3_FORCE_PATH_STYLE",
      genericEnv: "S3_FORCE_PATH_STYLE",
      fallback: "true",
    }) === "true",

  ENABLE_OCR: (process.env.ENABLE_OCR ?? "true") === "true",
  OCR_LANG: process.env.OCR_LANG ?? "eng",

  ENABLE_EMBEDDINGS: (process.env.ENABLE_EMBEDDINGS ?? "true") === "true",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  EMBEDDINGS_MODEL: process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small",

  CHUNK_SIZE: Number(process.env.CHUNK_SIZE ?? "900"),
  CHUNK_OVERLAP: Number(process.env.CHUNK_OVERLAP ?? "150"),
  SEARCH_LIMIT_DEFAULT: Number(process.env.SEARCH_LIMIT_DEFAULT ?? "8"),

  // Billing

  BACKEND_PUBLIC_URL:
    process.env.BACKEND_PUBLIC_URL ?? "http://127.0.0.1:8080",
  PAYFAST_MERCHANT_ID: process.env.PAYFAST_MERCHANT_ID ?? "",
  PAYFAST_MERCHANT_KEY: process.env.PAYFAST_MERCHANT_KEY ?? "",
  PAYFAST_PASSPHRASE: process.env.PAYFAST_PASSPHRASE ?? "",
  PAYFAST_SANDBOX: (process.env.PAYFAST_SANDBOX ?? "true") === "true",
  PAYFAST_RETURN_URL:
    process.env.PAYFAST_RETURN_URL ??
    `${process.env.FRONTEND_URL || "http://127.0.0.1:3000"}/billing/success`,
  PAYFAST_CANCEL_URL:
    process.env.PAYFAST_CANCEL_URL ??
    `${process.env.FRONTEND_URL || "http://127.0.0.1:3000"}/billing/cancel`,
  PAYFAST_NOTIFY_URL:
    process.env.PAYFAST_NOTIFY_URL ??
    `${process.env.BACKEND_PUBLIC_URL || "http://127.0.0.1:8080"}/api/v1/billing/payfast/notify`,
  DEV_TEST_ROUTES_ENABLED:
    (process.env.DEV_TEST_ROUTES_ENABLED ?? "false") === "true",
  PAYOUT_WEBHOOK_SECRET: process.env.PAYOUT_WEBHOOK_SECRET ?? "",

  // Chat & AI
  CHAT_ENABLED: (process.env.CHAT_ENABLED ?? "true") === "true",
  AI_PROVIDER: (process.env.AI_PROVIDER ?? "openai") as "openai" | "gemini",

  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL ?? "gpt-4-turbo-preview",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  GEMINI_CHAT_MODEL: process.env.GEMINI_CHAT_MODEL ?? "gemini-1.5-flash",
  CHAT_MAX_INPUT_CHUNKS: Number(process.env.CHAT_MAX_INPUT_CHUNKS ?? "10"),
  CHAT_MAX_CONTEXT_CHARS: Number(process.env.CHAT_MAX_CONTEXT_CHARS ?? "14000"),
  CHAT_MAX_OUTPUT_TOKENS: Number(process.env.CHAT_MAX_OUTPUT_TOKENS ?? "650"),

  // Chat Cost
  COST_CHAT_REQUEST_BASE: Number(process.env.COST_CHAT_REQUEST_BASE ?? "2"),
  COST_CHAT_PER_1K_INPUT_CHARS: Number(
    process.env.COST_CHAT_PER_1K_INPUT_CHARS ?? "1",
  ),
  COST_CHAT_PER_1K_OUTPUT_TOKENS: Number(
    process.env.COST_CHAT_PER_1K_OUTPUT_TOKENS ?? "3",
  ),

  // Sprint 7
  ALERTS_ENABLED: (process.env.ALERTS_ENABLED ?? "true") === "true",
  ALERTS_MAX_RULES_PER_ORG: Number(
    process.env.ALERTS_MAX_RULES_PER_ORG ?? "25",
  ),
  ALERTS_RULE_COOLDOWN_MINUTES: Number(
    process.env.ALERTS_RULE_COOLDOWN_MINUTES ?? "60",
  ),

  EMAIL_NOTIFICATIONS_ENABLED:
    (process.env.EMAIL_NOTIFICATIONS_ENABLED ?? "true") === "true",
  EMAIL_NOTIFICATIONS_FROM:
    process.env.EMAIL_NOTIFICATIONS_FROM ??
    "TenderLens <no-reply@tenderlens.co.za>",
  EMAIL_TEST_OVERRIDE_TO: process.env.EMAIL_TEST_OVERRIDE_TO ?? "",
  EMAIL_BRAND_NAME: process.env.EMAIL_BRAND_NAME ?? "TenderLens",
  EMAIL_BRAND_LOGO_URL: process.env.EMAIL_BRAND_LOGO_URL ?? "",
  EMAIL_BRAND_PRIMARY_COLOR:
    process.env.EMAIL_BRAND_PRIMARY_COLOR ?? "#0f766e",
  EMAIL_BRAND_BACKGROUND_COLOR:
    process.env.EMAIL_BRAND_BACKGROUND_COLOR ?? "#f5f7fb",
  EMAIL_BRAND_CARD_COLOR: process.env.EMAIL_BRAND_CARD_COLOR ?? "#ffffff",
  EMAIL_BRAND_TEXT_COLOR: process.env.EMAIL_BRAND_TEXT_COLOR ?? "#111827",
  EMAIL_BRAND_MUTED_COLOR: process.env.EMAIL_BRAND_MUTED_COLOR ?? "#6b7280",
  EMAIL_BRAND_BORDER_COLOR: process.env.EMAIL_BRAND_BORDER_COLOR ?? "#e5e7eb",
  EMAIL_BRAND_FOOTER_TEXT:
    process.env.EMAIL_BRAND_FOOTER_TEXT ??
    "This message was sent by TenderLens notifications.",

  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? "587"),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  GOOGLE_CLIENT_ID:
    process.env.GOOGLE_CLIENT_ID ??
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
    "",
  SENTRY_DSN: process.env.SENTRY_DSN ?? "",
  SENTRY_ENVIRONMENT:
    process.env.SENTRY_ENVIRONMENT ??
    process.env.NODE_ENV ??
    "development",
  SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? "",
  SENTRY_TRACES_SAMPLE_RATE: Number(
    process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0",
  ),

  MONTHLY_GRANTS_ENABLED:
    (process.env.MONTHLY_GRANTS_ENABLED ?? "true") === "true",
  MONTHLY_GRANT_CRON: process.env.MONTHLY_GRANT_CRON ?? "0 2 1 * *",

  TOKEN_ACCOUNTING_ENABLED:
    (process.env.TOKEN_ACCOUNTING_ENABLED ?? "true") === "true",

  // Sprint 8
  WATCHLIST_ENABLED: (process.env.WATCHLIST_ENABLED ?? "true") === "true",
  WATCHLIST_BATCH_WINDOW_MINUTES: Number(
    process.env.WATCHLIST_BATCH_WINDOW_MINUTES ?? "30",
  ),
  WATCHLIST_MAX_EMAILS_PER_DAY: Number(
    process.env.WATCHLIST_MAX_EMAILS_PER_DAY ?? "3",
  ),
  WATCHLIST_MAX_TENDERS_PER_EMAIL: Number(
    process.env.WATCHLIST_MAX_TENDERS_PER_EMAIL ?? "10",
  ),
  WATCHLIST_URGENT_REMINDER_TYPES:
    process.env.WATCHLIST_URGENT_REMINDER_TYPES ?? "CLOSING_2H",
  WATCHLIST_BATCHED_REMINDER_TYPES:
    process.env.WATCHLIST_BATCHED_REMINDER_TYPES ??
    "CLOSING_7D,CLOSING_24H,SITE_VISIT",
  PREFERENCES_ENABLED: (process.env.PREFERENCES_ENABLED ?? "true") === "true",
  DIGEST_ENABLED: (process.env.DIGEST_ENABLED ?? "true") === "true",
  DIGEST_CRON: process.env.DIGEST_CRON ?? "0 7 * * *",

  SMS_ENABLED:
    (process.env.SMS_ENABLED ?? process.env.WHATSAPP_ENABLED ?? "false") ===
    "true",
  SMS_PROVIDER:
    process.env.SMS_PROVIDER ?? process.env.WHATSAPP_PROVIDER ?? "twilio",
  SMS_FROM_NUMBER:
    process.env.SMS_FROM_NUMBER ??
    process.env.TWILIO_PHONE_NUMBER ??
    process.env.WHATSAPP_FROM_NUMBER ??
    "",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",

  DEADLINE_EXTRACTION_ENABLED:
    (process.env.DEADLINE_EXTRACTION_ENABLED ?? "true") === "true",
  DEADLINE_MODEL: process.env.DEADLINE_MODEL ?? "gpt-4o-mini",
  DEADLINE_MAX_TOKENS: Number(process.env.DEADLINE_MAX_TOKENS ?? "400"),

  COST_CAPS_ENABLED: (process.env.COST_CAPS_ENABLED ?? "true") === "true",
  ORG_DAILY_CREDIT_CAP: Number(process.env.ORG_DAILY_CREDIT_CAP ?? "5000"),
  USER_DAILY_CREDIT_CAP: Number(process.env.USER_DAILY_CREDIT_CAP ?? "1000"),

  // cost in credits for sending each SMS notification message (optional extra fee)
  COST_SMS_NOTIFICATION: Number(
    process.env.COST_SMS_NOTIFICATION ??
      process.env.COST_WHATSAPP_NOTIFICATION ??
      "1",
  ),

  // Sprint 9
  SMS_VERIFICATION_ENABLED:
    (
      process.env.SMS_VERIFICATION_ENABLED ??
      process.env.WHATSAPP_VERIFICATION_ENABLED ??
      "true"
    ) === "true",
  SMS_OTP_TTL_MINUTES: Number(
    process.env.SMS_OTP_TTL_MINUTES ??
      process.env.WHATSAPP_OTP_TTL_MINUTES ??
      "10",
  ),
  SMS_OTP_MAX_ATTEMPTS: Number(
    process.env.SMS_OTP_MAX_ATTEMPTS ??
      process.env.WHATSAPP_OTP_MAX_ATTEMPTS ??
      "5",
  ),
  SMS_OTP_RATE_LIMIT_PER_HOUR: Number(
    process.env.SMS_OTP_RATE_LIMIT_PER_HOUR ??
      process.env.WHATSAPP_OTP_RATE_LIMIT_PER_HOUR ??
      "5",
  ),

  REMINDERS_ENABLED: (process.env.REMINDERS_ENABLED ?? "true") === "true",
  REMIDER_CRON: process.env.REMINDER_CRON ?? "*/10 * * * *",
  REMINDER_WINDOWS_HOURS: process.env.REMINDER_WINDOWS_HOURS ?? "168,24,2",

  TENDER_COMPARE_ENABLED:
    (process.env.TENDER_COMPARE_ENABLED ?? "true") === "true",
  COMPARE_MODEL: process.env.COMPARE_MODEL ?? "gpt-4o-mini",
  COMPARE_MAX_TOKENS: Number(process.env.COMPARE_MAX_TOKENS ?? "700"),

  CHECKLIST_ENABLED: (process.env.CHECKLIST_ENABLED ?? "true") === "true",
  CHECKLIST_MODEL: process.env.CHECKLIST_MODEL ?? "gpt-4o-mini",
  CHECKLIST_MAX_TOKENS: Number(process.env.CHECKLIST_MAX_TOKENS ?? "900"),

  DELIVERY_QUEUE_ENABLED:
    (process.env.DELIVERY_QUEUE_ENABLED ?? "true") === "true",
  DELIVERY_MAX_ATTEMPTS: Number(process.env.DELIVERY_MAX_ATTEMPTS ?? "6"),
  DELIVERY_BACKOFF_BASE_SECONDS: Number(
    process.env.DELIVERY_BACKOFF_BASE_SECONDS ?? "30",
  ),

  // Sprint 11
  TEAM_COLLAB_ENABLED: (process.env.TEAM_COLLAB_ENABLED ?? "true") === "true",
  MENTIONS_ENABLED: (process.env.MENTIONS_ENABLED ?? "true") === "true",

  TASK_REMINDERS_ENABLED:
    (process.env.TASK_REMINDERS_ENABLED ?? "true") === "true",
  TASK_REMINDER_DUE_HOURS: Number(process.env.TASK_REMINDER_DUE_HOURS ?? "24"),
  TASK_REMINDER_OVERDUE_CRON:
    process.env.TASK_REMINDER_OVERDUE_CRON ?? "0 */6 * * *",
  TASK_REMINDER_DUE_CRON: process.env.TASK_REMINDER_DUE_CRON ?? "*/10 * * * *",
  TASK_REMINDER_DAILY_DEDUP:
    (process.env.TASK_REMINDER_DAILY_DEDUP ?? "true") === "true",
  BUSINESS_SUPPORT_SLA_ENABLED:
    (process.env.BUSINESS_SUPPORT_SLA_ENABLED ?? "true") === "true",
  BUSINESS_SUPPORT_SLA_CRON:
    process.env.BUSINESS_SUPPORT_SLA_CRON ?? "*/10 * * * *",

  SOCKET_ENABLED: (process.env.SOCKET_ENABLED ?? "true") === "true",
  SOCKET_PATH: process.env.SOCKET_PATH ?? "/socket.io",
  SOCKET_CORS_ORIGIN: parseOriginList(
    process.env.SOCKET_CORS_ORIGIN ?? "http://localhost:3005",
    "SOCKET_CORS_ORIGIN",
  ).join(","),
  SOCKET_ALLOWED_ORIGINS: parseOriginList(
    process.env.SOCKET_CORS_ORIGIN ?? "http://localhost:3005",
    "SOCKET_CORS_ORIGIN",
  ),

  ETENDERS_AUTO_IMPORT_ENABLED:
    (process.env.ETENDERS_AUTO_IMPORT_ENABLED ?? "true") === "true",
  ETENDERS_AUTO_IMPORT_CRON:
    process.env.ETENDERS_AUTO_IMPORT_CRON ?? "0 0 * * *",
  ETENDERS_AUTO_IMPORT_TIMEZONE:
    process.env.ETENDERS_AUTO_IMPORT_TIMEZONE ?? "Africa/Johannesburg",
  ETENDERS_AUTO_IMPORT_STATUSES:
    process.env.ETENDERS_AUTO_IMPORT_STATUSES ?? "1,2,3,4",
  ETENDERS_AUTO_IMPORT_LIMIT: Number(
    process.env.ETENDERS_AUTO_IMPORT_LIMIT ?? "250",
  ),
  ETENDERS_AUTO_IMPORT_START: Number(
    process.env.ETENDERS_AUTO_IMPORT_START ?? "0",
  ),
  ETENDERS_AUTO_IMPORT_WINDOW_HOURS: Number(
    process.env.ETENDERS_AUTO_IMPORT_WINDOW_HOURS ?? "24",
  ),
  ETENDERS_AUTO_IMPORT_STOP_ON_EXISTING:
    (process.env.ETENDERS_AUTO_IMPORT_STOP_ON_EXISTING ?? "false") === "true",
  ETENDERS_AUTO_IMPORT_USER_EMAIL:
    process.env.ETENDERS_AUTO_IMPORT_USER_EMAIL ?? "system+etenders-import@tenderlens.local",

  // Sprint 10
  ATTACHMENTS_ENABLED: (process.env.ATTACHMENTS_ENABLED ?? "true") === "true",
  ATTACHMENTS_MAX_MB: Number(process.env.ATTACHMENTS_MAX_MB ?? "25"),
  ATTACHMENTS_ALLOWED_MIME:
    process.env.ATTACHMENTS_ALLOWED_MIME ??
    "application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg",
  EXPORTS_ENABLED: (process.env.EXPORTS_ENABLED ?? "true") === "true",
  PDF_EXPORT_ENABLED: (process.env.PDF_EXPORT_ENABLED ?? "true") === "true",
  XLSX_EXPORT_ENABLED: (process.env.XLSX_EXPORT_ENABLED ?? "true") === "true",
  RISK_SCORING_ENABLED: (process.env.RISK_SCORING_ENABLED ?? "true") === "true",

  GOVERNANCE_STRICT: (process.env.GOVERNANCE_STRICT ?? "true") === "true",

  // Sprint 3 - Revenue
  TRIAL_CAMPAIGNS_ENABLED:
    (process.env.TRIAL_CAMPAIGNS_ENABLED ?? "true") === "true",
  TRIAL_EXPIRY_WARNING_HOURS: Number(
    process.env.TRIAL_EXPIRY_WARNING_HOURS ?? "48",
  ),
  TRIAL_POST_EXPIRY_DAY1: Number(process.env.TRIAL_POST_EXPIRY_DAY1 ?? "1"),
  TRIAL_POST_EXPIRY_DAY7: Number(process.env.TRIAL_POST_EXPIRY_DAY7 ?? "7"),

  VALUE_SUMMARY_ENABLED:
    (process.env.VALUE_SUMMARY_ENABLED ?? "true") === "true",

  ENTITLEMENT_WARNINGS_ENABLED:
    (process.env.ENTITLEMENT_WARNINGS_ENABLED ?? "true") === "true",
  ENTITLEMENT_WARN_THRESHOLD: Number(
    process.env.ENTITLEMENT_WARN_THRESHOLD ?? "0.8",
  ),
  ENTITLEMENT_WARN_COOLDOWN_HOURS: Number(
    process.env.ENTITLEMENT_WARN_COOLDOWN_HOURS ?? "72",
  ),

  EXPERIMENTS_ENABLED: (process.env.EXPERIMENTS_ENABLED ?? "true") === "true",
}

const insecureSecrets = [
  "super-secret-jwt-key",
  "super-secret-access-key",
  "super-secret-refresh-key",
  "super-secret-cookie-key",
  "6e8f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
  "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
  "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
]

const requiredRuntimeSecrets: Array<keyof typeof env> = [
  "JWT_SECRET",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "COOKIE_SECRET",
]

for (const key of requiredRuntimeSecrets) {
  const value = String(env[key] ?? "").trim()
  if (!value) {
    throw new Error(`Missing required secret env var: ${key}`)
  }
  if (insecureSecrets.includes(value)) {
    throw new Error(`Insecure default secret configured for: ${key}`)
  }
}

// Validation for production
if (env.NODE_ENV === "production") {
  const criticalKeys: Array<keyof typeof env> = [
    "DATABASE_URL",
    "PAYFAST_MERCHANT_ID",
    "PAYFAST_MERCHANT_KEY",
    "SMTP_PASS",
  ]

  if (env.AI_PROVIDER === "gemini") {
    criticalKeys.push("GEMINI_API_KEY")
  } else {
    criticalKeys.push("OPENAI_API_KEY")
  }

  for (const key of criticalKeys) {
    if (!env[key]) {
      throw new Error(`Missing critical env var in production: ${key}`)
    }
  }
}
