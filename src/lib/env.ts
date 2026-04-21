function requireEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getSupabaseUrl() {
  return requireEnv("SUPABASE_URL");
}

export function getSupabaseServiceRoleKey() {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getPinHash() {
  return requireEnv("APP_PIN_HASH");
}

export function getSessionSecret() {
  return requireEnv("APP_SESSION_SECRET");
}
