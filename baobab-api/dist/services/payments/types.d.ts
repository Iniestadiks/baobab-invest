export interface PayinData {
    amount: number;
    description: string;
    callbackUrl: string;
    returnUrl: string;
    cancelUrl: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customData?: any;
}
export interface PayoutData {
    amount: number;
    phoneNumber: string;
    operator: string;
    description: string;
}
export interface PayinResult {
    success: boolean;
    redirectUrl?: string;
    token?: string;
    raw: any;
}
export interface PayoutResult {
    success: boolean;
    raw: any;
}
export interface PaymentProvider {
    key: string;
    label: string;
    methods: ('mobile_money' | 'card')[];
    initPayin(data: PayinData): Promise<PayinResult>;
    checkPayin(token: string): Promise<{
        success: boolean;
        status: string;
        raw: any;
    }>;
    initPayout?(data: PayoutData): Promise<PayoutResult>;
    checkBalance?(): Promise<{
        balance: number;
        raw: any;
    }>;
}
//# sourceMappingURL=types.d.ts.map