"use client";

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
};

export function TtsToggle({ value, onChange }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      title={value ? "自动朗读：开（点击关闭）" : "自动朗读：关（点击开启）"}
      className={`flex items-center justify-center h-8 w-8 rounded-full border transition ${
        value
          ? "bg-niuniu-pink text-white border-niuniu-pink"
          : "bg-white/90 text-gray-400 border-niuniu-pinkSoft hover:text-niuniu-pink"
      }`}
    >
      {value ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
    </button>
  );
}

function SpeakerOnIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4"
      aria-hidden
    >
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 010 7.07l1.41 1.41a7 7 0 000-9.9l-1.41 1.42z" />
      <path d="M18.36 5.64a9 9 0 010 12.72l1.41 1.41a11 11 0 000-15.55l-1.41 1.42z" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4"
      aria-hidden
    >
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M19.07 4.93l-1.41 1.41L20.34 9l-2.68 2.66 1.41 1.41L21.76 10.41l2.68 2.66 1.41-1.41L23.17 9l2.68-2.66-1.41-1.41-2.68 2.66z" transform="translate(-3 0)" />
    </svg>
  );
}
