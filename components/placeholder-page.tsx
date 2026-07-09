import { TopBar } from "./topbar";
import { resolvePageContext } from "@/lib/page-context";

// Renders a not-yet-real nav destination: real top bar (month/₹/coverage all
// work) + a "coming in a later step" body, so the shell stays consistent.
export async function PlaceholderPage({
  title,
  monthParam,
}: {
  title: string;
  monthParam?: string;
}) {
  const { months, selectedMonth, coverage } = await resolvePageContext(monthParam);
  return (
    <>
      <TopBar
        title={title}
        months={months}
        selectedMonth={selectedMonth}
        coverage={coverage}
      />
      <div className="page">
        <div className="placeholder">
          <div>
            <div className="ph-ico">🚧</div>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>
              {title}
            </div>
            <div>This page is coming in a later step.</div>
          </div>
        </div>
      </div>
    </>
  );
}
