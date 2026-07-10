import type { Metadata } from "next";
import { WelcomeClient } from "./welcome-client";

export const metadata: Metadata = {
  title: "Welcome — Group MIS Console",
};

export default function WelcomePage() {
  return <WelcomeClient />;
}
