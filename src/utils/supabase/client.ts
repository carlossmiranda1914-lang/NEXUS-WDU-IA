import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : ((import.meta as any).env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseKey = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : ((import.meta as any).env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );
