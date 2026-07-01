"use client";

import type { HotelSettingsData } from "@/lib/settings";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SettingsFormProps = {
  settings: HotelSettingsData;
};

export function SettingsForm({ settings: initial }: SettingsFormProps) {
  const router = useRouter();
  const notifyPropertyProfileUpdated = () => {
    window.dispatchEvent(new Event("propertyProfileUpdated"));
  };
  const defaultPropertyProfile = {
    propertyName: "RealtyBytes PMS",
    website: "",
    tagline: "",
    address: "",
    phone: "",
    email: "",
    logo: "",
  };

  const [propertyProfile, setPropertyProfile] = useState(defaultPropertyProfile);
  const [form, setForm] = useState({
    name: initial.name,
    tagline: initial.tagline,
    address: initial.address ?? "",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    taxRate: String(initial.taxRate),
    currencyCode: initial.currencyCode,
    receiptFooter: initial.receiptFooter ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("propertyProfile");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<typeof defaultPropertyProfile>;
      setPropertyProfile((current) => ({
        ...current,
        ...parsed,
      }));
    } catch {
      // Ignore malformed localStorage data.
    }
  }, []);

  function updatePropertyProfile(patch: Partial<typeof defaultPropertyProfile>) {
    setPropertyProfile((current) => {
      const updatedProfile = {
        ...current,
        ...patch,
      };

      localStorage.setItem("propertyProfile", JSON.stringify(updatedProfile));
      setTimeout(() => {
        notifyPropertyProfileUpdated();
      }, 0);

      return updatedProfile;
    });
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a PNG, JPG, JPEG, or WEBP image.");
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 512;

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);

        const compressedLogo = canvas.toDataURL("image/png", 0.85);

        const updatedProfile = {
          ...propertyProfile,
          logo: compressedLogo,
        };

        setPropertyProfile(updatedProfile);
        localStorage.setItem("propertyProfile", JSON.stringify(updatedProfile));
        setTimeout(() => {
          notifyPropertyProfileUpdated();
        }, 0);
      };

      if (typeof event.target?.result === "string") {
        img.src = event.target.result;
      }
    };

    reader.readAsDataURL(file);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: propertyProfile.propertyName,
          tagline: form.tagline,
          address: form.address || null,
          phone: form.phone || null,
          email: form.email || null,
          taxRate: Number(form.taxRate),
          currencyCode: form.currencyCode,
          receiptFooter: form.receiptFooter || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage("Settings saved successfully.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {message && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-room-vacant">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">Property Profile</h3>
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Property Logo</h3>
              <p className="text-xs text-slate-500">
                Upload your property logo. Recommended size: 512 × 512 px. Accepted formats: PNG,
                JPG, WEBP.
              </p>
            </div>

            <div className="flex items-center gap-5">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {propertyProfile.logo ? (
                  <img
                    src={propertyProfile.logo}
                    alt="Property Logo"
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <span className="text-xs text-slate-400">No logo</span>
                )}
              </div>

              <div>
                <label className="inline-flex cursor-pointer items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                  Upload Logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>

                <p className="mt-2 text-xs text-slate-500">Best for square or transparent logo files.</p>
              </div>
            </div>
          </div>

          <label className="block text-sm">
            <span className="text-slate-500">Property Name</span>
            <input
              type="text"
              value={propertyProfile.propertyName || ""}
              onChange={(e) => {
                updatePropertyProfile({
                  propertyName: e.target.value,
                });
              }}
              placeholder="Enter property name"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Website</span>
            <input
              type="text"
              value={propertyProfile.website || ""}
              onChange={(e) => {
                updatePropertyProfile({
                  website: e.target.value,
                });
              }}
              placeholder="https://yourproperty.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Tagline</span>
            <input
              type="text"
              value={propertyProfile.tagline || ""}
              onChange={(e) => {
                updatePropertyProfile({
                  tagline: e.target.value,
                });
                setForm((f) => ({ ...f, tagline: e.target.value }));
              }}
              placeholder="Your comfort, our priority"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Address</span>
            <textarea
              value={propertyProfile.address || ""}
              onChange={(e) => {
                updatePropertyProfile({
                  address: e.target.value,
                });
                setForm((f) => ({ ...f, address: e.target.value }));
              }}
              placeholder="Enter property address"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-500">Phone</span>
              <input
                type="text"
                value={propertyProfile.phone || ""}
                onChange={(e) => {
                  updatePropertyProfile({
                    phone: e.target.value,
                  });
                  setForm((f) => ({ ...f, phone: e.target.value }));
                }}
                placeholder="Enter phone number"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Email</span>
              <input
                type="email"
                value={propertyProfile.email || ""}
                onChange={(e) => {
                  updatePropertyProfile({
                    email: e.target.value,
                  });
                  setForm((f) => ({ ...f, email: e.target.value }));
                }}
                placeholder="admin@property.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">Business Settings</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-500">Tax Rate (decimal)</span>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                value={form.taxRate}
                onChange={(e) => setForm((f) => ({ ...f, taxRate: e.target.value }))}
                className={fieldClass}
              />
              <span className="mt-1 block text-xs text-slate-400">0.12 = 12% VAT</span>
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Currency</span>
              <input value={form.currencyCode} onChange={(e) => setForm((f) => ({ ...f, currencyCode: e.target.value }))} className={fieldClass} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-500">Receipt Footer</span>
            <textarea
              value={form.receiptFooter}
              onChange={(e) => setForm((f) => ({ ...f, receiptFooter: e.target.value }))}
              rows={2}
              placeholder="Thank you for staying with us!"
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-room-vacant px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Savingâ€¦" : "Save Settings"}
      </button>
    </form>
  );
}
