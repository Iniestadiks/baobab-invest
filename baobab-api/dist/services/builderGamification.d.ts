export declare const BADGE_THRESHOLDS: {
    badge: string;
    points: number;
}[];
export declare function calcPoints(action: {
    type: 'DON_FONDS' | 'INVEST_DIRECT' | 'FONDS_UTILISE' | 'REMBOURSEMENT_OK';
    amount?: number;
}): number;
export declare function getBadgeFromPoints(points: number): string;
export declare function updateBuilderGamification(userId: string, action: {
    type: 'DON_FONDS' | 'INVEST_DIRECT' | 'FONDS_UTILISE' | 'REMBOURSEMENT_OK';
    amount?: number;
}): Promise<{
    newPoints: number;
    earned: number;
    newStreak: number;
}>;
export declare function updateTopDonor(): Promise<void>;
export declare function decrementInactiveBuilders(): Promise<void>;
//# sourceMappingURL=builderGamification.d.ts.map