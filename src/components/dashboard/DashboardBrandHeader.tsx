"use client";

import { useEffect, useState } from "react";

type PropertyProfile = {
  logo?: string;
  propertyName?: string;
  tagline?: string;
};

export function DashboardBrandHeader() {
  const [profile, setProfile] = useState<PropertyProfile>({});

  useEffect(() => {
    function loadProfile() {
      const savedProfile = JSON.parse(localStorage.getItem("propertyProfile") || "{}");
      setProfile(savedProfile);
    }

    loadProfile();

    window.addEventListener("propertyProfileUpdated", loadProfile);
    window.addEventListener("storage", loadProfile);

    return () => {
      window.removeEventListener("propertyProfileUpdated", loadProfile);
      window.removeEventListener("storage", loadProfile);
    };
  }, []);

  const dashboardLogo = profile.logo;
  const dashboardPropertyName = profile.propertyName || "RealtyBytes PMS";
  const dashboardTagline = profile.tagline || "Property Management System";

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 shadow-sm ring-1 ring-slate-200">
          {dashboardLogo ? (
            <img
              src={dashboardLogo}
              alt={dashboardPropertyName}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <span className="text-xl font-black text-emerald-700">RB</span>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-500">Welcome to</p>
          <h1 className="text-2xl font-black text-slate-900">{dashboardPropertyName}</h1>
          <p className="text-sm text-slate-500">{dashboardTagline}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Property dashboard is ready for today's operations.
      </div>
    </div>
  );
}
