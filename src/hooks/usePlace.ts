import { useState, useEffect } from "react";
import type { Place } from "../types/place";

export interface UsePlaceResult {
  place: Place | null;
  loading: boolean;
  error: string | null;
}

export function usePlace(id: string | undefined): UsePlaceResult {
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/places/${id}`, { signal: controller.signal })
      .then((r) => {
        if (r.status === 404) throw new Error("Place not found");
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json() as Promise<Place>;
      })
      .then((data) => {
        setPlace(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [id]);

  return { place, loading, error };
}
