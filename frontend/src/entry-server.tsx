import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { DataCacheProvider } from "./contexts/DataCacheContext";
import LandingPage from "./pages/LandingPage";

export function renderLandingHtml(): string {
  const html = renderToStaticMarkup(
    <DataCacheProvider>
      <AuthProvider>
        <SettingsProvider>
          <StaticRouter location="/">
            <LandingPage />
          </StaticRouter>
        </SettingsProvider>
      </AuthProvider>
    </DataCacheProvider>
  );
  return html;
}
