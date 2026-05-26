import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Room Status Display",
  description: "Live lobby room status board",
};

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-screen overflow-hidden bg-slate-950">{children}</div>;
}
