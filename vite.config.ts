import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Vercel may already provide the server-side Supabase variable names used by
// the API. Expose only the public project URL and anon/publishable key to the
// Vite bundle so the existing Club and League Portal auth flows can use the
// same Supabase project. Never fall back to the service-role key here.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.PUBLIC_SUPABASE_ANON_KEY || ''

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  }
})
