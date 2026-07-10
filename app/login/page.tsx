import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Sign in — Group MIS Console",
};

export default function LoginPage() {
  // useSearchParams (for ?next=) needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="welcome" />}>
      <LoginClient />
    </Suspense>
  );
}
