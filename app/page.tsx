"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getProfile, getToken, type UserProfile } from "@/lib/api";

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace(/-/g, "_").trim();
}

function internalLandingPath(user: UserProfile) {
  const roles = [normalizeRole(user.role), ...(user.roles || []).map(normalizeRole)].filter(Boolean);
  if (roles.includes("FIN_ACCOUNTS")) return "/finance";
  if (roles.includes("HR_ADMIN") || roles.includes("SUPERADMIN")) return "/hr";
  return "/hr";
}

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getProfile()
      .then((profile) => router.replace(internalLandingPath(profile)))
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <main className="main">
      <Loader2 className="spin" />
      <p>Opening Mac Internal</p>
    </main>
  );
}
