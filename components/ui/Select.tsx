"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Dark, keyboard-accessible replacement for the native select popup.
 * Windows renders native option menus with a white OS surface even when the
 * surrounding app is dark, so relying on CSS alone cannot keep the visual
 * language consistent.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const generatedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const labelId = `${generatedId}-label`;
  const buttonId = `${generatedId}-button`;
  const listboxId = `${generatedId}-listbox`;
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function openAt(index: number) {
    setActiveIndex(index);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openAt(selectedIndex);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + options.length) % options.length);
      return;
    }

    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(activeIndex);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span id={labelId} className="block text-sm">
        {label}
      </span>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-labelledby={`${labelId} ${buttonId}`}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${generatedId}-option-${activeIndex}` : undefined}
        className="field-input mt-1 flex items-center justify-between gap-3 text-left"
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={handleKeyDown}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-neutral-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-white/10 bg-neutral-950 p-1.5 shadow-2xl shadow-black/60"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <div
                id={`${generatedId}-option-${index}`}
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-100"
                    : "text-neutral-300 hover:bg-white/[0.06]"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={15} className="shrink-0 text-emerald-400" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
