"use client";
import { useEffect, useState } from "react";

export interface PlatformConfig {
  // Commissions collecte
  commission_baobab_collection: number;  // 6%
  commission_mentor: number;             // 2%
  commission_guarantee: number;          // 2%
  // Payin/Payout
  payin_recovery: number;                // 4%
  payin_repayment: number;               // 4%
  // Retrait
  withdrawal_fee_standard: number;       // 0%
  withdrawal_fee_no_invest: number;      // 7%
  // Taux retour
  return_min: number;                    // 23%
  // Délais de grâce
  grace_period_agriculture: number;      // 2
  grace_period_other: number;            // 1
  // Montants minimum
  investment_min: number;                // 5000
  withdrawal_min: number;               // 5000
}

// Valeurs par défaut — TOUJOURS synchronisées avec la base
const DEFAULTS: PlatformConfig = {
  commission_baobab_collection: 6,
  commission_mentor: 2,
  commission_guarantee: 2,
  payin_recovery: 4,
  payin_repayment: 4,
  withdrawal_fee_standard: 0,
  withdrawal_fee_no_invest: 7,
  return_min: 23,
  grace_period_agriculture: 2,
  grace_period_other: 1,
  investment_min: 5000,
  withdrawal_min: 5000,
};

// Helpers calculés automatiquement depuis la config
export function computeGoalAmount(netAmount: number, hasMentor: boolean, hasInsurance: boolean, cfg: PlatformConfig): number {
  const baobab = cfg.commission_baobab_collection / 100;
  const mentor = hasMentor ? cfg.commission_mentor / 100 : 0;
  const guarantee = hasInsurance ? cfg.commission_guarantee / 100 : 0;
  const diviseur = 1 - baobab - mentor - guarantee;
  return Math.ceil(netAmount / diviseur);
}

export function computeFees(amount: number, hasMentor: boolean, withInsurance: boolean, cfg: PlatformConfig) {
  const platformFee   = Math.round(amount * cfg.commission_baobab_collection / 100);
  const payinFee      = Math.round(amount * cfg.payin_recovery / 100);
  const mentorFee     = hasMentor ? Math.round(amount * cfg.commission_mentor / 100) : 0;
  const guaranteeFee  = withInsurance ? Math.round(amount * cfg.commission_guarantee / 100) : 0;
  const reinvested    = withInsurance ? 0 : Math.round(amount * cfg.commission_guarantee / 100);
  const totalFees     = platformFee + payinFee + mentorFee + guaranteeFee;
  const netToProject  = amount - totalFees + reinvested;
  return { platformFee, payinFee, mentorFee, guaranteeFee, reinvested, totalFees, netToProject };
}

export function computeReturn(netAmount: number, returnRate: number, sharePercent: number, cfg: PlatformConfig) {
  const rate = Math.max(returnRate, cfg.return_min);
  const totalReturn = Math.round(netAmount * (1 + rate / 100));
  const payinRepayment = Math.round(totalReturn * cfg.payin_repayment / 100);
  const netDistributed = totalReturn - payinRepayment;
  const investorTotal = Math.round(netDistributed * sharePercent);
  return { totalReturn, payinRepayment, netDistributed, investorTotal };
}

// Cache global en mémoire
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
          res.data.forEach((c: any) => { cfg[c.key] = Number(c.value); });
          const merged = { ...DEFAULTS, ...cfg };
          globalConfig = merged;
          lastFetch = Date.now();
          setConfig(merged);
        }
      })
      .catch(() => setConfig(DEFAULTS))
      .finally(() => setLoading(false));
  }, []);

  // Forcer le rechargement depuis l'API (après modification admin)
  const reload = () => {
    globalConfig = null;
    lastFetch = 0;
  };

  return { config, loading, reload, fees: config };
}
