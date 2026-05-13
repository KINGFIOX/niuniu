"use client";

import { useEffect, useRef, useState } from "react";
import { MODULES, type ModuleId } from "@/lib/systemPrompt";

type Props = {
  value: ModuleId;
  onChange: (id: ModuleId) => void;
  disabled?: boolean;
};

export function ModuleSwitcher({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = MODULES.find((m) => m.id === value) ?? MODULES[0];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 border border-niuniu-pinkSoft text-sm text-gray-700 hover:bg-niuniu-pinkSoft transition disabled:opacity-50"
      >
        <span aria-hidden className="text-niuniu-pink">●</span>
        <span className="font-semibold">{current.short}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="选择教学模块"
          className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-bubble border border-niuniu-pinkSoft overflow-hidden z-20"
        >
          <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-gray-400 bg-niuniu-pinkSoft/40">
            教学模块
          </div>
          <ul className="py-1 max-h-80 overflow-y-auto">
            {MODULES.map((m) => {
              const selected = m.id === value;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-niuniu-pinkSoft/60 transition ${
                      selected ? "bg-niuniu-pinkSoft/40" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-800">
                        {m.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {m.description}
                      </div>
                    </div>
                    {selected ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-5 h-5 text-niuniu-pink shrink-0 mt-0.5"
                        aria-hidden
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.41 0l-3.5-3.5a1 1 0 011.41-1.42L8.5 12.09l6.79-6.8a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
