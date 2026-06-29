import { Response } from 'express';
export declare function generateInvestmentCertificate(res: Response, data: {
    investor: any;
    investment: any;
    project: any;
    fees?: any;
}): void;
export declare function generateInvestorStatement(res: Response, data: {
    investor: any;
    investments: any[];
    wallet: any;
    period: string;
    fees?: any;
}): void;
export declare function generateProjectReport(res: Response, data: {
    project: any;
    entrepreneur: any;
    investments: any[];
    milestones: any[];
    fees?: any;
}): void;
export declare function generateMentorReport(res: Response, data: {
    mentor: any;
    projects: any[];
    wallet: any;
    fees?: any;
}): void;
export declare function generateAdminReport(res: Response, data: {
    stats: any;
    projects: any[];
    revenues: any[];
    fees?: any;
}): void;
export declare function generateBuilderReport(res: Response, data: {
    builder: any;
    contributions: any[];
    wallet: any;
    badges: any[];
    impactData: any;
}): void;
//# sourceMappingURL=pdf.d.ts.map