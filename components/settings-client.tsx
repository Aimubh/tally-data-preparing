"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUIState } from "./ui-state";
import { updateProfile, updateAvatar, removeAvatar } from "@/app/settings/actions";
import { TiltedCard } from "./tilted-card";

interface ProfileData {
  name: string;
  email: string;
  avatarUrl: string | null;
  designation: string | null;
}

/**
 * Settings body (client) — a list/nav on the left + detail panel on the right.
 * Clicking a nav item swaps the active section (pure client state, instant):
 *   - Profile       → update admin name / email / password
 *   - Theme         → Light/Dark appearance + ₹ Full/Lakh amount format
 *   - Verification  → email verification status (send-email button is a stub)
 *   - User Settings → placeholder (more preferences coming later)
 */
type SectionId = "profile" | "theme" | "verification" | "user";

const NAV: { id: SectionId; label: string; icon: string; desc: string }[] = [
  { id: "profile", label: "Profile", icon: "👤", desc: "Name, email & password" },
  { id: "theme", label: "Theme", icon: "🎨", desc: "Appearance & amount format" },
  { id: "verification", label: "Verification", icon: "✓", desc: "Email verification status" },
  { id: "user", label: "User Settings", icon: "⚙", desc: "More preferences" },
];

export function SettingsClient({ profile }: { profile: ProfileData }) {
  const [active, setActive] = useState<SectionId>("profile");

  return (
    <div className="page">
      <div className="settings-layout">
        {/* --- Left list nav --- */}
        <nav className="settings-nav" aria-label="Settings sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`settings-nav-item${active === item.id ? " on" : ""}`}
              aria-current={active === item.id ? "page" : undefined}
              onClick={() => setActive(item.id)}
            >
              <span className="sn-ico" aria-hidden="true">{item.icon}</span>
              <span className="sn-text">
                <span className="sn-label">{item.label}</span>
                <span className="sn-desc">{item.desc}</span>
              </span>
              <span className="sn-caret" aria-hidden="true">›</span>
            </button>
          ))}
        </nav>

        {/* --- Right detail panel: the active section --- */}
        <div className="settings-detail">
          {active === "profile" && <ProfileCard profile={profile} />}
          {active === "theme" && <ThemeSection />}
          {active === "verification" && <VerificationSection email={profile.email} />}
          {active === "user" && <UserSettingsSection />}
        </div>
      </div>
    </div>
  );
}

/** Theme + amount-format appearance controls. */
function ThemeSection() {
  const { theme, setTheme, rupeeMode, toggleRupeeMode, hydrated } = useUIState();
  return (
    <section className="panel settings-card">
      <div className="settings-head">
        <div className="settings-title">Theme</div>
        <div className="settings-sub">
          Choose how the console looks. Your choice is remembered on this device.
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-label">
          <div className="srl-title">Appearance</div>
          <div className="srl-desc">
            Light canvas or a dark canvas for low-light use.
          </div>
        </div>
        <div className="theme-switch" role="group" aria-label="Theme">
          <button
            className={theme === "light" ? "on" : ""}
            aria-pressed={theme === "light"}
            onClick={() => setTheme("light")}
            disabled={!hydrated}
          >
            <span className="ts-ico" aria-hidden="true">☀︎</span>
            Light
          </button>
          <button
            className={theme === "dark" ? "on" : ""}
            aria-pressed={theme === "dark"}
            onClick={() => setTheme("dark")}
            disabled={!hydrated}
          >
            <span className="ts-ico" aria-hidden="true">☾</span>
            Dark
          </button>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-label">
          <div className="srl-title">Amount format</div>
          <div className="srl-desc">
            Show figures in full rupees or in lakhs. Also available in the top bar.
          </div>
        </div>
        <div className="theme-switch" role="group" aria-label="Amount format">
          <button
            className={rupeeMode === "full" ? "on" : ""}
            aria-pressed={rupeeMode === "full"}
            onClick={() => rupeeMode !== "full" && toggleRupeeMode()}
          >
            ₹ Full
          </button>
          <button
            className={rupeeMode === "lakh" ? "on" : ""}
            aria-pressed={rupeeMode === "lakh"}
            onClick={() => rupeeMode !== "lakh" && toggleRupeeMode()}
          >
            ₹ Lakh
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Email verification status. No mail server is wired yet, so the account reads
 * as "Not verified" and the send button is a stub that only shows a notice.
 */
function VerificationSection({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  return (
    <section className="panel settings-card">
      <div className="settings-head">
        <div className="settings-title">Verification</div>
        <div className="settings-sub">
          Confirm the admin email so account-recovery messages can reach you.
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-label">
          <div className="srl-title">Email address</div>
          <div className="srl-desc">{email || "—"}</div>
        </div>
        <span className="verify-badge unverified" aria-label="Email not verified">
          <span className="vb-dot" aria-hidden="true" />
          Not verified
        </span>
      </div>

      <div className="pf-divider" />

      {sent ? (
        <div className="pf-msg success" role="status">
          If email delivery were configured, a verification link would now be on
          its way to {email}. (Mail sending isn’t wired up yet.)
        </div>
      ) : (
        <div className="verify-actions">
          <button className="pf-save" onClick={() => setSent(true)}>
            Send verification email
          </button>
          <span className="verify-note">
            Email delivery is not configured in this build.
          </span>
        </div>
      )}
    </section>
  );
}

/** Placeholder — more per-user preferences will land here later. */
function UserSettingsSection() {
  return (
    <section className="panel settings-card">
      <div className="settings-head">
        <div className="settings-title">User Settings</div>
        <div className="settings-sub">
          Per-user preferences for the console.
        </div>
      </div>
      <div className="settings-empty">
        <div className="se-ico" aria-hidden="true">🛠️</div>
        <div className="se-title">More settings coming soon</div>
        <div className="se-desc">
          Additional user preferences will appear here in a later step.
        </div>
      </div>
    </section>
  );
}

/**
 * Admin profile update — name / email / (optional) new password. Every save is
 * authorised by the current password. Loud validation and inline success/error.
 */
function ProfileCard({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [designation, setDesignation] = useState(profile.designation ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Avatar state ---
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl);
  const [avatarPending, setAvatarPending] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  function initials(n: string): string {
    const parts = n.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarPending(true);
    const fd = new FormData();
    fd.set("avatar", file);
    startTransition(async () => {
      const res = await updateAvatar(fd);
      setAvatarPending(false);
      if (res.ok) {
        setAvatarUrl(res.avatarUrl ?? null);
        router.refresh(); // sidebar avatar updates
      } else {
        setAvatarError(res.error ?? "Could not upload image.");
      }
    });
    // allow re-picking the same file later
    e.target.value = "";
  }

  function onRemoveAvatar() {
    setAvatarError(null);
    setAvatarPending(true);
    startTransition(async () => {
      const res = await removeAvatar();
      setAvatarPending(false);
      if (res.ok) {
        setAvatarUrl(null);
        router.refresh();
      } else {
        setAvatarError(res.error ?? "Could not remove image.");
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("email", email);
    fd.set("designation", designation);
    fd.set("currentPassword", currentPassword);
    fd.set("newPassword", newPassword);
    fd.set("confirmPassword", confirmPassword);
    startTransition(async () => {
      const res = await updateProfile(fd);
      if (res.ok) {
        setSuccess(res.message ?? "Saved.");
        // Clear password fields; keep name/email as the new saved values.
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        // Refresh so the sidebar (name/email from the re-issued session) updates.
        router.refresh();
      } else {
        setError(res.error ?? "Could not save changes.");
      }
    });
  }

  return (
    <section className="panel settings-card">
      <div className="settings-head">
        <div className="settings-title">Profile</div>
        <div className="settings-sub">
          Update your admin name, sign-in email, and password. Confirm with your
          current password to save.
        </div>
      </div>

      {/* --- Profile card preview: appears once a name AND image are set --- */}
      {name.trim() && avatarUrl && (
        <div className="profile-card-preview">
          <TiltedCard
            imageSrc={avatarUrl}
            altText={`${name} — ${designation || "Administrator"}`}
            name={name}
            designation={designation || "Administrator"}
            status="Online"
            contactText="Contact Me"
            showUserInfo
            containerHeight="420px"
            containerWidth="320px"
            rotateAmplitude={12}
            scaleOnHover={1.05}
            behindGlowColor="rgba(125, 190, 255, 0.67)"
            innerGradient="linear-gradient(145deg,#60496e 0%,#71C4FF 100%)"
            onContactClick={() =>
              (window.location.href = `mailto:${email}`)
            }
          />
        </div>
      )}

      {/* --- Avatar (uploads immediately, separate from the form submit) --- */}
      <div className="avatar-row">
        <div className="avatar-preview" aria-hidden={avatarUrl ? undefined : true}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Profile" />
          ) : (
            <span className="avatar-initials">{initials(name)}</span>
          )}
        </div>
        <div className="avatar-controls">
          <div className="avatar-label">Profile photo</div>
          <div className="avatar-actions">
            <button
              type="button"
              className="avatar-btn"
              onClick={() => fileRef.current?.click()}
              disabled={avatarPending}
            >
              {avatarPending ? "Uploading…" : avatarUrl ? "Change" : "Upload image"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                className="avatar-btn ghost"
                onClick={onRemoveAvatar}
                disabled={avatarPending}
              >
                Remove
              </button>
            )}
          </div>
          <div className="avatar-hint">PNG, JPG, WebP or GIF · up to 2 MB</div>
          {avatarError && (
            <div className="pf-msg error" role="alert">
              {avatarError}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={onPickAvatar}
          />
        </div>
      </div>

      <div className="pf-divider" />

      <form className="profile-form" onSubmit={onSubmit}>
        <div className="pf-field">
          <label htmlFor="pf-name">Name</label>
          <input
            id="pf-name"
            className="pf-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div className="pf-field">
          <label htmlFor="pf-email">Email</label>
          <input
            id="pf-email"
            className="pf-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="pf-field">
          <label htmlFor="pf-designation">Designation</label>
          <input
            id="pf-designation"
            className="pf-input"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. Group Finance Controller"
            autoComplete="organization-title"
          />
        </div>

        <div className="pf-divider" />
        <div className="pf-hint">
          Leave the password fields blank to keep your current password.
        </div>

        <div className="pf-field">
          <label htmlFor="pf-new">New password</label>
          <input
            id="pf-new"
            className="pf-input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>

        <div className="pf-field">
          <label htmlFor="pf-confirm">Confirm new password</label>
          <input
            id="pf-confirm"
            className="pf-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div className="pf-divider" />

        <div className="pf-field">
          <label htmlFor="pf-current">Current password</label>
          <input
            id="pf-current"
            className="pf-input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Required to save"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="pf-msg error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="pf-msg success" role="status">
            {success}
          </div>
        )}

        <div className="pf-actions">
          <button type="submit" className="pf-save" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
