import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { DataCacheProvider } from "./contexts/DataCacheContext";
import LandingPage from "./pages/LandingPage";
import AppSkeleton from "./components/ui/AppSkeleton";

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

/**
 * Markup for the static app shell (dist/app.html) — the same AppSkeleton the app
 * renders while it boots, so the first paint and the React state are identical.
 * Called at build time by scripts/prerender.mjs.
 */
export function renderSkeletonHtml(): string {
  return renderToStaticMarkup(<AppSkeleton />);
}
