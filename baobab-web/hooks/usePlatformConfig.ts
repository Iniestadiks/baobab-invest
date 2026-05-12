"use client";
import { useEffect, useState } from "react";

export interface PlatformConfig {
  commission_baobab_collection: number;
  commission_baobab_return: number;
  commission_mentor: number;
  commission_guarantee: number;
  paydunya_payin: number;
  paydunya_payout: number;
  return_min_with_mentor: number;
  return_min_no_mentor: number;
  investment_min: number;
  withdrawal_min: number;
}

// Valeurs par défaut si l'API est inaccessible
const DEFAULTS: PlatformConfig = {
  commission_baobab_collection: 5,
  commission_baobab_return: 5,
  commission_mentor: 2,
  commission_guarantee: 2,
  paydunya_payin: 3,
  paydunya_payout: 2,
  return_min_with_mentor: 15,
  return_min_no_mentor: 17,
  investment_min: 5000,
  withdrawal_min: 5000,
};

// Cache global en mémoire pour éviter les appels répétés
let globalConfig: PlatformConfig | null = null;
let lastFetch = 0;

export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfig>(globalConfig || DEFAULTS);
  const [loading, setLoading] = useState(!globalConfig);

  useEffect(() => {
    const now = Date.now();
    // Cache 5 minutes
    if (globalConfig && now - lastFetch < 5 * 60 * 1000) {
      setConfig(globalConfig);
      setLoading(false);
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/config/public`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          const cfg: any = {};
          res.data.forEach((c: any) => { cfg[c.key] = c.value; });
          const merged = { ...DEFAULTS, ...cfg };
          globalConfig = merged;
          lastFetch = Date.now();
          setConfig(merged);
        }
      })
      .catch(() => setConfig(DEFAULTS))
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}
