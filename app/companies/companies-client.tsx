"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCompany, setArchived } from "./actions";
import { monthLabel } from "@/lib/format";
import type { CompanyCard } from "@/lib/mis";

export function CompaniesClient({ cards }: { cards: CompanyCard[] }) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleArchive(id: string, archived: boolean) {
    startTransition(async () => {
      await setArchived(id, archived);
      router.refresh();
    });
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div style={{ flex: 1 }} />
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Add company
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="empty">
          No companies yet. Add one to start — it will instantly appear in
          coverage dots and every report with a &ldquo;no data&rdquo; state.
        </div>
      ) : (
        <div className="card-grid">
          {cards.map((c) => (
            <div
              key={c.id}
              className={`company-card${c.isActive ? "" : " archived"}`}
            >
              <button
                className="arch-btn"
                onClick={() => toggleArchive(c.id, c.isActive)}
                disabled={pending}
                title={c.isActive ? "Archive company" : "Unarchive company"}
              >
                {c.isActive ? "Archive" : "Unarchive"}
              </button>
              <div
                className="swatch"
                style={{ background: c.chartColor }}
                aria-hidden="true"
              />
              <div className="cname">
                {c.name}
                {!c.isActive && <span className="badge-archived">Archived</span>}
              </div>
              <div className="cshort">{c.shortName}</div>
              <div className="meta">
                <span>
                  <b>{c.monthsPresent}</b> month
                  {c.monthsPresent === 1 ? "" : "s"} of data
                </span>
                <span>
                  Latest:{" "}
                  <b>{c.latestMonth ? monthLabel(c.latestMonth) : "—"}</b>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddCompanyModal
          onClose={() => setShowModal(false)}
          onAdded={() => {
            setShowModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function AddCompanyModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addCompany(formData);
      if (res.ok) onAdded();
      else setError(res.error ?? "Could not add company.");
    });
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add company"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add company</h2>
        <form action={submit}>
          <div className="field">
            <label htmlFor="name">Company name</label>
            <input id="name" name="name" autoFocus placeholder="e.g. Delta Foods Pvt Ltd" />
          </div>
          <div className="field">
            <label htmlFor="shortName">Short name</label>
            <input id="shortName" name="shortName" placeholder="e.g. Delta" />
            {error && <div className="err">{error}</div>}
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 4px" }}>
            A chart colour is assigned automatically. The company appears
            everywhere immediately, with &ldquo;no data&rdquo; until an upload
            exists.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Adding…" : "Add company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
