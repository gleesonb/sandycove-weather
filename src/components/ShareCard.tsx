import { useState } from "react";

interface ShareCardProps {
  verdict: { text: string; emoji: string; bg: string };
  temp: number;
  windSpeed: number;
  rainExpected: boolean;
  seaTemp?: number;
  tideInfo?: string;
}

export default function ShareCard({ verdict, temp, windSpeed, rainExpected, seaTemp, tideInfo }: ShareCardProps) {
  const [copied, setCopied] = useState(false);

  const shareText = `${verdict.emoji} ${verdict.text}

📍 Forty Foot, Sandycove
🌡️ ${temp.toFixed(1)}°C · ${seaTemp ? `Sea ${seaTemp.toFixed(1)}°C` : ""}
💨 ${windSpeed.toFixed(0)} km/h
🌧️ ${rainExpected ? "Rain expected" : "Dry skies"}${tideInfo ? `\n🌊 ${tideInfo}` : ""}

weather.billgleeson.com`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${verdict.emoji} Sandycove Weather`,
          text: shareText,
          url: "https://weather.billgleeson.com",
        });
      } catch {
        // User cancelled
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleShare}
      className="p-2 rounded-lg hover:bg-white/10 transition-colors text-xl leading-none cursor-pointer"
      aria-label="Share swim conditions"
      title="Share swim conditions"
    >
      {copied ? (
        <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.59 13.51l6.83 3.98" />
          <path d="M15.41 6.51l-6.82 3.98" />
        </svg>
      )}
    </button>
  );
}
