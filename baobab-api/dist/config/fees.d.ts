export interface Fees {
    commission_baobab_collection: number;
    payin_recovery: number;
    commission_mentor: number;
    commission_guarantee: number;
    payin_repayment: number;
    withdrawal_fee_standard: number;
    withdrawal_fee_no_invest: number;
    return_min: number;
    grace_period_agriculture: number;
    grace_period_other: number;
}
export declare const DEFAULT_FEES: Fees;
export declare const FEE_LABELS: Record<string, string>;
export declare function getFees(): Promise<Fees>;
//# sourceMappingURL=fees.d.ts.map