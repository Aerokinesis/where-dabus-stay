import { createClient } from "@supabase/supabase-js";

// Browser Supabase client — used ONLY by the /admin editor page. The public
// app never talks to Supabase directly; it reads announcements through
// Express (/api/announcements) so the main bundle keeps one API origin.
//
// The anon key is safe to ship: row-level security (supabase/0001_*.sql)
// decides what each signed-in user may do.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;
