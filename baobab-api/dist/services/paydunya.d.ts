export declare function initPayin(data: {
    amount: number;
    description: string;
    callbackUrl: string;
    returnUrl: string;
    cancelUrl: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customData?: any;
}): Promise<unknown>;
export declare function checkPayin(token: string): Promise<unknown>;
export declare function initPayout(data: {
    amount: number;
    phoneNumber: string;
    operator: string;
    description: string;
}): Promise<unknown>;
export declare function checkBalance(): Promise<unknown>;
//# sourceMappingURL=paydunya.d.ts.map