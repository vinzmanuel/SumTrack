import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://sumtrack.org",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    // The internal dashboard routes are deliberately excluded from the sitemap.
  ];
}
