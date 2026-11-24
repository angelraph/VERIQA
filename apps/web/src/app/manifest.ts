import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Veriga",
    short_name: "Veriga",
    description: "Record every sale, cash or crypto, and turn it into credit.",
    start_url: "/sell",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f7fd",
    theme_color: "#7c3aed",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Record a sale", url: "/sell", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
      { name: "Dashboard", url: "/dashboard", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
      { name: "My receipts", url: "/me/receipts", icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
