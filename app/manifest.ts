import type { MetadataRoute } from "next";

// Lets providers add the portal to their phone's home screen (UX review #14). No offline caching of records.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Real Care Provider Portal",
    short_name: "Real Care",
    description: "Training, forms and messages for Real Care providers.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f5f2",
    theme_color: "#8224e3",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/real-care-logo.png", sizes: "480x377", type: "image/png" },
    ],
  };
}
