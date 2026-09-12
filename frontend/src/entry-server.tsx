import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { DataCacheProvider } from "./contexts/DataCacheContext";
import LandingPage from "./pages/LandingPage";

export function renderLandingHtml(): string {
  const html = renderToStaticMarkup(
    <AuthProvider>
      <SettingsProvider>
        <DataCacheProvider>
          <StaticRouter location="/">
            <LandingPage />
          </StaticRouter>
        </DataCacheProvider>
      </SettingsProvider>
    </AuthProvider>
  );
  return html;
}
