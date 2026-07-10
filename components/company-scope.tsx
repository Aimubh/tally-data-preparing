"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Company scope selector — the COMPANY SCOPE RULE control required on every
 * report page. First option is always "All companies" (the combined group view
 * with inter-company eliminated). Selecting a single company gives the
 * standalone view (inter-company included). Drives the ?company= URL param.
 */
export interface ScopeCompany {
  id: string;
  shortName: string;
}

export function CompanyScope({
  companies,
  selected,
}: {
  companies: ScopeCompany[];
  selected: string; // "all" or a company id
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function pick(value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value === "all") sp.delete("company");
    else sp.set("company", value);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="control">
      <label className="ctl-label" htmlFor="company-scope">
        Scope
      </label>
      <select
        id="company-scope"
        className="month-select"
        value={selected}
        onChange={(e) => pick(e.target.value)}
      >
        <option value="all">All companies</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.shortName}
          </option>
        ))}
      </select>
    </div>
  );
}
