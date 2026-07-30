import type { MetadataRoute } from "next";

// Next.js's built-in manifest route convention - serves this at
// /manifest.webmanifest automatically, no separate public/manifest.json
// needed. This is the minimum for "Add to Home Screen" installability
// (task: make the app installable as a PWA, pre-pilot stabilization sprint).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Rebuild",
    short_name: "Rebuild",
    description: "Três decisões por dia, com contexto do teu calendário.",
    start_url: "/today",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
