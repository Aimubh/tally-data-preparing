"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCompany, setArchived, deleteCompany } from "./actions";
import { monthLabel } from "@/lib/format";
import type { CompanyCard } from "@/lib/mis";

export function CompaniesClient({ cards }: { cards: CompanyCard[] }) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Delete flow: which company is pending confirmation, delete-in-progress, error.
  const [confirmDelete, setConfirmDelete] = useState<CompanyCard | null>(null);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function toggleArchive(id: string, archived: boolean) {
    startTransition(async () => {
      await setArchived(id, archived);
      router.refresh();
    });
  }

  function doDelete(c: CompanyCard) {
    setDeleteError(null);
    startDelete(async () => {
      const res = await deleteCompany(c.id);
      if (res.ok) {
        setConfirmDelete(null);
        router.refresh();
      } else {
        setDeleteError(res.error ?? "Could not delete the company.");
      }
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
          {cards.map((c, idx) => (
            <div
              key={c.id}
              className={`company-card reveal${c.isActive ? "" : " archived"}`}
              style={{ ["--i" as string]: idx }}
            >
              <div className="card-actions">
                <button
                  className="arch-btn"
                  onClick={() => toggleArchive(c.id, c.isActive)}
                  disabled={pending}
                  title={c.isActive ? "Archive company" : "Unarchive company"}
                >
                  {c.isActive ? "Archive" : "Unarchive"}
                </button>
                <button
                  className="del-btn"
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmDelete(c);
                  }}
                  title="Delete company and all its data"
                  aria-label={`Delete ${c.name} and all its data`}
                >
                  Delete
                </button>
              </div>
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

      {/* Confirm-delete-company dialog (destructive: cascades all its data) */}
      {confirmDelete && (
        <div
          className="modal-overlay"
          onClick={() => !deleting && setConfirmDelete(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete company"
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete {confirmDelete.shortName}?</h2>
            <p style={{ margin: "0 0 8px", color: "var(--muted)" }}>
              This permanently deletes <strong>{confirmDelete.name}</strong> and{" "}
              <strong>all of its data</strong> — every upload, trial balance,
              sales/purchase voucher, note, debtor/creditor balance, and expense
              across all {confirmDelete.monthsPresent} month
              {confirmDelete.monthsPresent === 1 ? "" : "s"}.
            </p>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--warning)", fontWeight: 600 }}>
              This cannot be undone.
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
              Tip: if you only want to hide it while keeping history, use{" "}
              <strong>Archive</strong> instead.
            </p>
            {deleteError && (
              <div className="field" style={{ marginTop: 10 }}>
                <div className="err">{deleteError}</div>
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => doDelete(confirmDelete)}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete company & data"}
              </button>
            </div>
          </div>
        </div>
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
