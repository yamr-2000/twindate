import "react-native-url-polyfill/auto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function isValidUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://");
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  if (!isValidUrl(supabaseUrl)) {
    throw new Error(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and " +
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env file."
    );
  }

  _client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return _client;
}

/**
 * Returns true if the Supabase environment variables are configured
 * (i.e., not placeholders).
 */
export function isSupabaseConfigured(): boolean {
  return isValidUrl(supabaseUrl) && supabaseKey.length > 0;
}

/**
 * Lazy-initialized Supabase client via a Proxy.
 * All property access is forwarded to the real client, which is only
 * created the first time it's actually used.  This prevents the app
 * from crashing at import time when .env values are still placeholders.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
