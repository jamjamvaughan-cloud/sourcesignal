import { MetadataRoute } from "next";
import { MACRO_SECTORS } from "@/lib/config/sectors";

const SITE_URL = "https://sourcesignal.example.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  const staticRoutes = [
    "/",
    "/dashboard",
    "/dashboard/opportunities",
    "/dashboard/pipeline",
    "/dashboard/map",
    "/dashboard/alerts",
    "/dashboard/saved",
    "/dashboard/integrations",
    "/dashboard/profile",
    "/auth/signin",
    "/auth/signup",
    "/create",
    "/privacy",
    "/terms",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "daily" as const,
    priority: route === "/" ? 1 : 0.8,
  }));

  const sectorRoutes = MACRO_SECTORS.flatMap((macroSector) =>
    macroSector.subIndustries.map((sub) => ({
      url: `${baseUrl}/dashboard/opportunities?sector=${sub.id}`,
      lastModified: new Date().toISOString(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  );

  return [...staticRoutes, ...sectorRoutes];
}
