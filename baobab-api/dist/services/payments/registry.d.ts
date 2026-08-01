import type { PaymentProvider } from './types';
export declare function ensurePaymentProviderConfigs(): Promise<void>;
export declare function getEnabledProviders(): Promise<{
    provider: PaymentProvider;
    methods: string[];
}[]>;
export declare function getProvider(key: string): Promise<PaymentProvider | null>;
export declare function getAllProviderConfigs(): Promise<{
    id: string;
    updatedAt: Date;
    key: string;
    label: string;
    methods: string;
    enabled: boolean;
    sortOrder: number;
}[]>;
//# sourceMappingURL=registry.d.ts.map