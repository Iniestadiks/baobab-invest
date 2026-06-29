export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
export declare const generateOTP: () => string;
export declare const generateReference: () => string;
export declare const successResponse: (res: any, data: any, message?: string, statusCode?: number) => any;
export declare const errorResponse: (res: any, message?: string, statusCode?: number) => any;
//# sourceMappingURL=helpers.d.ts.map