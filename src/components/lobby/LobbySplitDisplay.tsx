"use client";

import { LobbyRoomDisplay } from "@/components/lobby/LobbyRoomDisplay";
import type { LobbyDisplayData, LobbyRoomsSide } from "@/lib/lobby-display";

type LobbySplitDisplayProps = {
  initialData: LobbyDisplayData;
  displayKey?: string;
  adsUrl: string | null;
  roomsSide?: LobbyRoomsSide;
};

function AdsPanel({ adsUrl }: { adsUrl: string | null }) {
  if (adsUrl) {
    return (
      <iframe
        src={adsUrl}
        title="Lobby advertisements"
        className="h-full w-full border-0 bg-black"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-black px-8 text-center text-white">
      <p className="text-xl font-semibold">Ads panel</p>
      <p className="mt-3 max-w-sm text-sm text-slate-400">
        Replace <code className="text-slate-200">your-ad-url</code> with the real web address of your
        ad slideshow or video page.
      </p>
      <p className="mt-3 max-w-sm text-sm text-slate-400">
        Set <code className="text-slate-200">LOBBY_ADS_URL</code> in Railway, or use{" "}
        <code className="text-slate-200">&amp;ads=https://…</code> in the lobby URL.
      </p>
    </div>
  );
}

export function LobbySplitDisplay({
  initialData,
  displayKey,
  adsUrl,
  roomsSide = "left",
}: LobbySplitDisplayProps) {
  const roomsPanel = (
    <div className="h-full min-w-0 overflow-hidden border-white/10">
      <LobbyRoomDisplay
        initialData={initialData}
        displayKey={displayKey}
        variant="split"
      />
    </div>
  );

  const adsPanel = (
    <div className="h-full min-w-0 overflow-hidden bg-black">
      <AdsPanel adsUrl={adsUrl} />
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {roomsSide === "left" ? (
        <>
          <div className="h-full w-1/2 shrink-0 border-r border-white/10">{roomsPanel}</div>
          <div className="h-full w-1/2 shrink-0">{adsPanel}</div>
        </>
      ) : (
        <>
          <div className="h-full w-1/2 shrink-0 border-r border-white/10">{adsPanel}</div>
          <div className="h-full w-1/2 shrink-0">{roomsPanel}</div>
        </>
      )}
    </div>
  );
}
