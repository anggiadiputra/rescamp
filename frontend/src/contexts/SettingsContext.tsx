import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "../lib/api";

export interface SystemSettings {
  brand_name: string;
  site_tagline: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  og_image_url: string;
  primary_color: string;
  header_color: string;
  sidebar_color: string;
  email_provider: string;
  [key: string]: any;
}

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  brand_name: "DomainWhois",
  site_tagline: "High-Performance Domain & Hosting Management Platform",
  seo_title: "DomainWhois — Domain Registrar & Management",
  seo_description: "Manage, register, transfer, and renew domains effortlessly.",
  seo_keywords: "domain, registrar, whois, dns, hosting",
  og_image_url: "",
  primary_color: "#000000",
  header_color: "#ffffff",
  sidebar_color: "#ffffff",
  email_provider: "kirisan",
};

interface SettingsContextType {
  settings: SystemSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [loading, setLoading] = useState(true);

  async function fetchSettings() {
    try {
      const res = await api.get<any>("/settings");
      const data = res?.data || res;
      if (data && typeof data === "object") {
        setSettings((prev) => ({
          ...prev,
          ...data,
        }));
      }
    } catch (err) {
      console.warn("[SettingsContext] Unable to fetch settings, using defaults:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  // Dynamically update document title and primary color CSS variables
  useEffect(() => {
    if (settings.seo_title || settings.brand_name) {
      document.title = settings.seo_title || `${settings.brand_name} — Domain Registrar`;
    }
  }, [settings.seo_title, settings.brand_name]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return { settings: DEFAULT_SYSTEM_SETTINGS, loading: false, refreshSettings: async () => {} };
  }
  return ctx;
}
