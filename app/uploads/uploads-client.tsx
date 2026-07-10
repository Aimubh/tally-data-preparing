"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUIState } from "@/components/ui-state";
import { formatBracketed } from "@/lib/format";
import { parseUpload, deleteUpload, type UploadPreview, type UploadKind } from "./actions";

export interface UploadCompany {
  id: string;
  shortName: string;
  name: string;
}
export interface ExistingUpload {
  id: string;
  companyShort: string;
  period: string;
  fileType: string;
  uploadedAt: string;
}

const KINDS: { value: UploadKind; label: string; hint: string }[] = [
  { value: "TrialBalance", label: "Trial Balance", hint: "Particulars · Debit · Credit · Grand Total" },
  { value: "SalesRegister", label: "Sales Register", hint: "Date · Particulars · Vch Type/No · Debit · Credit" },
  { value: "JournalRegister", label: "Journal Register", hint: "Date · Particulars · Vch Type/No · Debit · Credit" },
];

function monthOptions(dbMonths: string[]): string[] {
  // Offer DB months plus the current + a few recent, deduped.
  const set = new Set(dbMonths);
  return [...set].sort().reverse();
}

function monthLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function UploadsClient({
  companies,
  months,
  existing,
}: {
  companies: UploadCompany[];
  months: string[];
  existing: ExistingUpload[];
}) {
  const [companyId, setCompanyId] = useState("");
  const [period, setPeriod] = useState(months[months.length - 1] ?? "");
  const [kind, setKind] = useState<UploadKind>("TrialBalance");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Delete flow: which upload is pending confirmation, and delete-in-progress.
  const [confirmDelete, setConfirmDelete] = useState<ExistingUpload | null>(null);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const monthChoices = monthOptions(months);

  function doDelete(u: ExistingUpload) {
    setDeleteError(null);
    startDelete(async () => {
      const res = await deleteUpload(u.id);
      if (res.ok) {
        setConfirmDelete(null);
        router.refresh();
      } else {
        setDeleteError(res.error ?? "Could not delete.");
      }
    });
  }

  function onFile(f: File | null) {
    setFileName(f ? f.name : null);
    setPreview(null);
  }

  function submit() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    fd.set("companyId", companyId);
    fd.set("period", period);
    fd.set("kind", kind);
    startTransition(async () => {
      const res = await parseUpload(fd);
      setPreview(res);
    });
  }

  function reset() {
    setPreview(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <form
        ref={formRef}
        className="upload-panel"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="upload-fields">
          <div className="field">
            <label htmlFor="u-company">Company</label>
            <select
              id="u-company"
              className="month-select"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Select company…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="u-period">Reporting month</label>
            <select
              id="u-period"
              className="month-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {monthChoices.length === 0 && <option value="">No months</option>}
              {monthChoices.map((p) => (
                <option key={p} value={p}>
                  {monthLabel(p)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="u-kind">File type</label>
            <select
              id="u-kind"
              className="month-select"
              value={kind}
              onChange={(e) => setKind(e.target.value as UploadKind)}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="upload-kind-hint">
          {KINDS.find((k) => k.value === kind)?.hint}
        </p>

        {/* Drop zone */}
        <label
          className={`dropzone${dragOver ? " over" : ""}${fileName ? " has-file" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0] ?? null;
            if (f && fileRef.current) {
              const dt = new DataTransfer();
              dt.items.add(f);
              fileRef.current.files = dt.files;
            }
            onFile(f);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <span className="dz-icon" aria-hidden="true">
            ⬆
          </span>
          {fileName ? (
            <span className="dz-file">{fileName}</span>
          ) : (
            <span className="dz-text">
              Drop a Tally <strong>.xlsx</strong> export here, or click to choose
            </span>
          )}
        </label>

        <div className="upload-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={pending || !companyId || !period || !fileName}
          >
            {pending ? "Parsing…" : "Parse & review"}
          </button>
          {(preview || fileName) && (
            <button type="button" className="btn-ghost" onClick={reset} disabled={pending}>
              Clear
            </button>
          )}
        </div>
      </form>

      {preview && <ReviewScreen preview={preview} companies={companies} onCancel={reset} />}

      <h2>
        Existing uploads
        <span className="h2-note">
          re-uploading the same company + month + type replaces it
        </span>
      </h2>
      <div className="pl-wrap">
        {existing.length === 0 ? (
          <div className="empty">No uploads yet.</div>
        ) : (
          <table className="pl">
            <thead>
              <tr>
                <th className="rowhead">Company</th>
                <th className="rowhead">Month</th>
                <th className="rowhead">File type</th>
                <th className="rowhead">Uploaded</th>
                <th className="rowhead" style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {existing.map((u) => (
                <tr key={u.id} className="line">
                  <td className="rowhead">{u.companyShort}</td>
                  <td className="rowhead">{monthLabel(u.period)}</td>
                  <td className="rowhead">{u.fileType}</td>
                  <td className="rowhead" style={{ color: "var(--mute-light)" }}>
                    {u.uploadedAt}
                  </td>
                  <td className="rowhead" style={{ textAlign: "right" }}>
                    <button
                      className="del-btn"
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmDelete(u);
                      }}
                      aria-label={`Delete ${u.companyShort} ${monthLabel(u.period)} ${u.fileType}`}
                      title="Delete this upload and its data"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm-delete dialog */}
      {confirmDelete && (
        <div
          className="modal-overlay"
          onClick={() => !deleting && setConfirmDelete(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete this upload?</h2>
            <p style={{ margin: "0 0 6px", color: "var(--muted)" }}>
              This permanently removes{" "}
              <strong>
                {confirmDelete.companyShort} · {monthLabel(confirmDelete.period)} ·{" "}
                {confirmDelete.fileType}
              </strong>{" "}
              and all data it brought in for that company and month.
            </p>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--warning)" }}>
              This cannot be undone.
            </p>
            {deleteError && <div className="field"><div className="err">{deleteError}</div></div>}
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
                {deleting ? "Deleting…" : "Delete upload & data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function ReviewScreen({
  preview,
  companies,
  onCancel,
}: {
  preview: UploadPreview;
  companies: UploadCompany[];
  onCancel: () => void;
}) {
  const { rupeeMode } = useUIState();
  const f = (n: number) => formatBracketed(n, rupeeMode).text;
  const selectedCompany = companies.find((c) => c.id === preview.companyId);
  const isTB = preview.kind === "TrialBalance";

  const hardFail = !preview.ok;

  return (
    <div className={`review-card${hardFail ? " fail" : preview.totalValidates ? " pass" : ""}`}>
      {/* Verdict banner */}
      {hardFail ? (
        <div className="review-verdict fail">
          <span className="rv-ico">✕</span>
          <div>
            <div className="rv-title">Upload rejected — validation failed</div>
            {preview.errors.map((e, i) => (
              <div key={i} className="rv-msg">
                {e}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="review-verdict pass">
          <span className="rv-ico">✓</span>
          <div>
            <div className="rv-title">
              Parsed clean — totals validate against the Grand Total
            </div>
            <div className="rv-msg">
              Review the {isTB ? "ledgers and suggested P&L lines" : "vouchers"} below, then confirm to save.
            </div>
          </div>
        </div>
      )}

      {/* Title block */}
      <div className="review-meta">
        <div>
          <span className="rm-k">File company</span>
          <span className="rm-v">{preview.companyName ?? "—"}</span>
        </div>
        <div>
          <span className="rm-k">Uploading as</span>
          <span className="rm-v">{selectedCompany?.shortName ?? "—"}</span>
        </div>
        <div>
          <span className="rm-k">Period in file</span>
          <span className="rm-v">{preview.periodLabel ?? "—"}</span>
        </div>
        <div>
          <span className="rm-k">Rows</span>
          <span className="rm-v">{preview.rowCount}</span>
        </div>
        <div>
          <span className="rm-k">Σ Debit</span>
          <span className="rm-v">{f(preview.sumDebit)}</span>
        </div>
        <div>
          <span className="rm-k">Σ Credit</span>
          <span className="rm-v">{f(preview.sumCredit)}</span>
        </div>
        <div>
          <span className="rm-k">Grand Total</span>
          <span className="rm-v">
            {preview.grandTotalDebit != null ? f(preview.grandTotalDebit) : "—"} /{" "}
            {preview.grandTotalCredit != null ? f(preview.grandTotalCredit) : "—"}
          </span>
        </div>
        <div>
          <span className="rm-k">Validation</span>
          <span className={`rm-v ${preview.totalValidates ? "ok" : "bad"}`}>
            {preview.totalValidates ? "✓ Passes" : "✕ Fails"}
          </span>
        </div>
      </div>

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div className="review-warnings">
          {preview.warnings.map((w, i) => (
            <div key={i}>
              ⚠ {w.row ? `Row ${w.row}: ` : ""}
              {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Parsed rows */}
      <div className="pl-wrap" style={{ marginTop: 14 }}>
        <table className="pl register">
          {isTB ? (
            <>
              <thead>
                <tr>
                  <th className="rowhead">Ledger</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                  <th className="rowhead">Suggested P&amp;L line</th>
                  <th className="rowhead">Inter-company</th>
                </tr>
              </thead>
              <tbody>
                {preview.ledgers?.map((l, i) => (
                  <tr key={i} className="line">
                    <td className="rowhead">{l.ledgerName}</td>
                    <td className="num">{l.debit ? f(l.debit) : ""}</td>
                    <td className="num">{l.credit ? f(l.credit) : ""}</td>
                    <td className="rowhead vch">{plLabel(l.plLine)}</td>
                    <td className="rowhead">
                      {l.isInterCompany ? <span className="ic-chip">IC</span> : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th className="rowhead">Date</th>
                  <th className="rowhead">Particulars</th>
                  <th className="rowhead">Vch Type</th>
                  <th className="rowhead">Vch No.</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                </tr>
              </thead>
              <tbody>
                {preview.vouchers?.map((v, i) => (
                  <tr key={i} className="line">
                    <td className="rowhead">{v.date ?? ""}</td>
                    <td className="rowhead">{v.particulars}</td>
                    <td className="rowhead vch">{v.vchType}</td>
                    <td className="rowhead vch">{v.vchNo}</td>
                    <td className="num">{v.debit ? f(v.debit) : ""}</td>
                    <td className="num">{v.credit ? f(v.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>

      {/* Commit / cancel */}
      <div className="review-commit">
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" disabled title="Commit-to-database is the next step">
          Confirm &amp; save
        </button>
        <span className="commit-note">
          Saving to the database is the next build step — this screen is review-only for now.
        </span>
      </div>
    </div>
  );
}

function plLabel(pl: string): string {
  const map: Record<string, string> = {
    Revenue: "Revenue",
    OtherIncome: "Other Income",
    PurchasesCOGS: "Purchases / COGS",
    DirectExpenses: "Direct Expenses",
    Employee: "Employee",
    SellingDistribution: "Selling & Distribution",
    AdminOther: "Admin & Other",
    Finance: "Finance",
    Depreciation: "Depreciation",
    Tax: "Tax",
    BalanceSheetOrIgnore: "Balance Sheet / Ignore",
  };
  return map[pl] ?? pl;
}
