// vite.config.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },

  vite: {
    plugins: [
      nitro({
        preset: "vercel",
      }),
    ],

    /**
     * Lovable injects VITE_* env vars automatically.
     * Supabase client expects SUPABASE_PUBLISHABLE_KEY.
     * We bridge them here safely at build time.
     */
    define: {
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env.SUPABASE_PUBLISHABLE_KEY
      ),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env.SUPABASE_URL
      ),
    },
  },
});
