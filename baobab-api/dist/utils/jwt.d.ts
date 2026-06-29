export declare const generateAccessToken: (userId: string, role: string) => string;
export declare const generateRefreshToken: (userId: string) => string;
export declare const verifyRefreshToken: (token: string) => {
    userId: string;
};
//# sourceMappingURL=jwt.d.ts.map