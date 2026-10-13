/**
 * Full-page loading skeleton.
 *
 * Used as the boot/route-guard fallback (session check) and as the Suspense
 * fallback for lazy page chunks, so the transition is continuous:
 *
 *   static skeleton in app.html  →  this component  →  real page
 *
 * It must stay visually identical to the static shell markup injected into
 * app.html by scripts/prerender.mjs, which renders THIS component through
 * entry-server.tsx and inlines src/styles/app-skeleton.css. Class names come from
 * that shared stylesheet — do not swap them for Tailwind utilities, or the two
 * states will drift apart.
 *
 * Styles are pure CSS (no script), which is what keeps the static shell working
 * under the template's meta CSP.
 */
export default function AppSkeleton() {
  return (
    <div className="appskel" aria-hidden="true">
      <div className="appskel__bar">
        <span className="sk sk--circle" />
        <span className="sk sk--text sk--brand" />
        <span className="appskel__spacer" />
        <span className="sk sk--pill-sm" />
        <span className="sk sk--pill-md" />
      </div>
      <div className="appskel__body">
        <span className="sk sk--title" />
        <div className="appskel__grid">
          <span className="sk sk--card" />
          <span className="sk sk--card" />
          <span className="sk sk--card" />
          <span className="sk sk--card" />
        </div>
        <span className="sk sk--text sk--label" />
        <span className="sk sk--block" />
      </div>
    </div>
  );
}
