import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

function requirePublicSupabaseEnv(): import("vite").Plugin {
  return {
    name: "require-public-supabase-env",
    config(_, { command, mode }) {
      if (command !== "build") return;
      const env = loadEnv(mode, process.cwd(), "");
      if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
        throw new Error(
          "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Cloudflare (Builds → Variables and secrets) e rode o deploy de novo.",
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [
    requirePublicSupabaseEnv(),
    tanstackStart({ server: { entry: "server" } }),
    react(),
    tailwindcss(),
    nitro({ preset: "cloudflare_module" }),
  ],
  resolve: { tsconfigPaths: true },
});
