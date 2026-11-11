import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import fs from "node:fs";

export default defineConfig({
  server: {
    // Listen on the LAN too, not only on localhost: a phone or a headset joins by the Mac's IP.
    host: true,
    // WebXR needs a secure context: over the LAN (e.g. a headset on http://192.168.x.x:5173)
    // plain http disables the XR buttons. `npm run cert` makes ssl/, and dev then serves https.
    https: fs.existsSync("ssl/cert.pem")
      ? { cert: "ssl/cert.pem", key: "ssl/key.pem" }
      : undefined,
  },
  plugins: [
    react(),
    tailwindcss(),
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
