// src/utils/autosave.ts
import { useEffect, useRef, useState } from "react";

export function useAutosave<T>(
  value: T,
  saveFn: (v: T) => Promise<any>,
  delay = 800,
) {
  const [saving, setSaving] = useState(false);
  const last = useRef<T>(value);
  const timer = useRef<any>(null);

  useEffect(() => {
    const same =
      JSON.stringify(value) === JSON.stringify(last.current);
    if (same) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveFn(value);
        last.current = value;
      } finally {
        setSaving(false);
      }
    }, delay);
    return () => timer.current && clearTimeout(timer.current);
  }, [value, saveFn, delay]);

  return saving;
}