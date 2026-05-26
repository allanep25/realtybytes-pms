import { LobbyRoomDisplay } from "@/components/lobby/LobbyRoomDisplay";
import { LobbySplitDisplay } from "@/components/lobby/LobbySplitDisplay";
import {
  getLobbyDisplayData,
  isValidLobbyDisplayKey,
  parseLobbyLayoutMode,
  parseLobbyRoomsSide,
  resolveLobbyAdsUrl,
} from "@/lib/lobby-display";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LobbyPageProps = {
  searchParams: Promise<{ key?: string; split?: string; ads?: string; side?: string }>;
};

export default async function LobbyPage({ searchParams }: LobbyPageProps) {
  const { key, split, ads, side } = await searchParams;

  if (!isValidLobbyDisplayKey(key)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-semibold">Lobby display locked</h1>
          <p className="mt-3 text-slate-400">
            Add the display key to the URL, for example{" "}
            <code className="rounded bg-black/40 px-2 py-1 text-sm text-slate-200">/lobby?key=your-key</code>
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Split screen with ads:{" "}
            <code className="text-slate-300">/lobby?key=…&amp;split=1&amp;ads=https://…</code>
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm text-room-cleaning hover:underline">
            Staff login
          </Link>
        </div>
      </div>
    );
  }

  const data = await getLobbyDisplayData();
  const layout = parseLobbyLayoutMode(split);
  const adsUrl = resolveLobbyAdsUrl(ads);

  if (layout === "split") {
    return (
      <LobbySplitDisplay
        initialData={data}
        displayKey={key}
        adsUrl={adsUrl}
        roomsSide={parseLobbyRoomsSide(side)}
      />
    );
  }

  return <LobbyRoomDisplay initialData={data} displayKey={key} />;
}
