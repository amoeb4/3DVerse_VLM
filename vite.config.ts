import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ["util"], // fournit une vraie implémentation de "util" au lieu du stub externalisé par Vite
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis", // ensures `global` references work in the browser
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true, // polyfill Buffer
        }),
      ],
    },
  },
  define: {
    global: "globalThis", // another safeguard for runtime code
  },
});
