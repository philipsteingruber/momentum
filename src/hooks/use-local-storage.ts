import { useCallback, useEffect, useState } from "react";

export const useLocalStorage = <T>(key: string, defaultValue: T): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const item = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (item) setStoredValue(JSON.parse(item) as T);
    } catch {
      // Ignore read errors
    }
  }, [key]);

  const setValue = useCallback(
    (value: T) => {
      try {
        setStoredValue(value);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(value));
        }
      } catch {
        // Ignore write errors (e.g. private browsing storage quota)
      }
    },
    [key],
  );

  return [storedValue, setValue];
};
