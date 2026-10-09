"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { useAuth, userDisplayName, userInitials } from "@/components/auth-provider";

export function AccountMenu() {
  const { user } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase || signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="account-menu">
      <span className="avatar" aria-hidden="true">{userInitials(user)}</span>
      <span className="account-copy">
        <strong>{userDisplayName(user)}</strong>
        <span>{user?.email}</span>
      </span>
      <button type="button" onClick={() => void signOut()} disabled={signingOut}>
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
