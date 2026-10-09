"use client";

import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { AccountMenu } from "@/components/account-menu";
import { useAuth } from "@/components/auth-provider";

type FormValues = { name: string; mobile_number: string; emergency_contact: string; plate_number: string; raspi_unique_id: string };
const initial: FormValues = { name: "", mobile_number: "", emergency_contact: "", plate_number: "", raspi_unique_id: "" };

export default function AddDriver() {
  const router = useRouter();
  const { user } = useAuth();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof FormValues, value: string) { setValues((current) => ({ ...current, [field]: value })); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const supabase = getSupabase();
    if (!supabase) { setError("Set your Supabase URL and key in .env.local and restart the app."); return; }
    if (!user) { setError("Your session expired. Sign in again before adding a driver."); return; }
    const raspiId = values.raspi_unique_id.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(raspiId)) { setError("Raspberry Pi ID may contain only letters, numbers, dashes, and underscores."); return; }
    setSaving(true);
    const { error: insertError } = await supabase.from("drivers").insert({
      name: values.name.trim(), mobile_number: values.mobile_number.trim(),
      emergency_contact: values.emergency_contact.trim(),
      plate_number: values.plate_number.trim().toUpperCase(), raspi_unique_id: raspiId,
      owner_id: user.id,
    });
    setSaving(false);
    if (insertError) {
      if (insertError.message.includes("owner_id") && insertError.message.includes("schema cache")) {
        setError("The Supabase database has not been upgraded yet. Run the latest supabase/schema.sql in the Supabase SQL Editor, then try again.");
      } else {
        setError(insertError.code === "23505" ? "That Raspberry Pi ID is already assigned to a driver." : insertError.message);
      }
      return;
    }
    router.push("/");
  }

  return <div className="app-shell"><Sidebar active="add" /><main className="main-content"><header className="topbar"><div className="breadcrumb">Operations <span>/</span> Add driver</div><AccountMenu /></header><div className="page-content form-page"><Link href="/" className="back-link">← Back to overview</Link><div className="page-heading"><div><p className="eyebrow">FLEET MANAGEMENT</p><h1>Add a new driver</h1><p className="subheading">Register a driver and connect their Raspberry Pi unit.</p></div></div><form className="form-card" onSubmit={(event) => void submit(event)}><div className="form-section-header"><span className="form-section-icon">01</span><div><h2>Driver details</h2><p>Contact and vehicle information for this driver.</p></div></div><div className="form-grid"><label className="field"><span>Full name <b>*</b></span><input required maxLength={120} placeholder="e.g. Aditya Putra" value={values.name} onChange={(e) => update("name", e.target.value)} /></label><label className="field"><span>Mobile number <b>*</b></span><input required type="tel" maxLength={32} placeholder="e.g. +62 812 3456 7890" value={values.mobile_number} onChange={(e) => update("mobile_number", e.target.value)} /></label><label className="field"><span>Emergency contact <b>*</b></span><input required type="tel" maxLength={32} placeholder="e.g. +62 812 9876 5432" value={values.emergency_contact} onChange={(e) => update("emergency_contact", e.target.value)} /></label><label className="field"><span>Plate number <b>*</b></span><input required maxLength={32} placeholder="e.g. B 1234 XYZ" value={values.plate_number} onChange={(e) => update("plate_number", e.target.value)} /></label><label className="field"><span>Raspberry Pi unique ID <b>*</b></span><input required pattern="[A-Za-z0-9_-]+" title="Letters, numbers, dashes, and underscores only" placeholder="e.g. 10000000abcdef12" value={values.raspi_unique_id} onChange={(e) => update("raspi_unique_id", e.target.value)} /><small>Use the serial number from the device’s /proc/cpuinfo.</small></label></div>{error && <div className="notice error" role="alert">{error}</div>}<div className="form-actions"><Link href="/" className="secondary-button">Cancel</Link><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save driver →"}</button></div></form></div></main></div>;
}
