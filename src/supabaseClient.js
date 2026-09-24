import { createClient } from '@supabase/supabase-js'

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const anonKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
).trim()

export const hasSupabaseConfig = Boolean(url && anonKey)

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
