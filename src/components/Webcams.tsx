import { useState, useEffect } from "react";

const WEBCAMS = [
  {
    id: "east-pier",
    name: "Dun Laoghaire & East Pier",
    description: "North across Dublin Bay towards Howth",
    snapshot: "https://s55.ipcamlive.com/streams/37ugmsin5q2jvpdiq/snapshot.jpg",
    playerUrl: "https://g0.ipcamlive.com/player/player.php?alias=5d933014c3f12",
  },
  {
    id: "anchorage",
    name: "Dublin Bay Ship Anchorage",
    description: "Northeast over the shipping lane",
    snapshot: "https://s21.ipcamlive.com/streams/15k736ytjdrhqirvo/snapshot.jpg",
    playerUrl: "https://g0.ipcamlive.com/player/player.php?alias=628cab8ec5e2c",
  },
  {
    id: "forty-foot",
    name: "Sandycove & Forty Foot",
    description: "South towards the Forty Foot & Martello Tower",
    snapshot: "https://s44.ipcamlive.com/streams/6008744a58a63/snapshot.jpg",
    playerUrl: "https://g0.ipcamlive.com/player/player.php?alias=6008744a58a63",
  },
];

export default function Webcams() {
  const [selected, setSelected] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Refresh snapshots every 15s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(interval);
  }, []);

  const cam = selected ? WEBCAMS.find((c) => c.id === selected) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {WEBCAMS.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(selected === c.id ? null : c.id)}
            className={`card overflow-hidden text-left cursor-pointer group transition-all ${
              selected === c.id ? "ring-2 ring-ocean-500 dark:ring-ocean-400" : ""
            }`}
          >
            <div className="relative aspect-video bg-ocean-100 dark:bg-ocean-900 overflow-hidden">
              <img
                src={`${c.snapshot}?t=${tick}`}
                alt={c.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-ocean-400/40 dark:text-ocean-600/40 text-3xl pointer-events-none">
                Offline
              </div>
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-medium text-white uppercase tracking-wider">Live</span>
              </div>
            </div>
            <div className="p-3">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-ocean-600 dark:group-hover:text-ocean-400 transition-colors">
                {c.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {c.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Expanded view — larger snapshot + link to live stream */}
      {cam && (
        <div className="card overflow-hidden">
          <div className="relative aspect-video bg-ocean-100 dark:bg-ocean-900 overflow-hidden">
            <img
              src={`${cam.snapshot}?t=${tick}`}
              alt={cam.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-ocean-400/30 text-4xl pointer-events-none">
              Offline
            </div>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-white uppercase tracking-wider">Live — refreshes every 15s</span>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center justify-between border-t border-ocean-100/50 dark:border-white/[0.06]">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{cam.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{cam.description}</div>
            </div>
            <a
              href={cam.playerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-ocean-600 dark:text-ocean-400 hover:underline whitespace-nowrap"
            >
              Watch live stream ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
