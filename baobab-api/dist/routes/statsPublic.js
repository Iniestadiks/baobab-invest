"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const [userCount, projectStats, fund, configRates] = await Promise.all([
            database_1.default.user.count({ where: { role: { not: 'ADMIN' }, isActive: true } }),
            database_1.default.project.aggregate({
                where: { status: { in: ['ACTIVE', 'FUNDED', 'IN_PROGRESS', 'COMPLETED'] } },
                _sum: { raisedAmount: true },
                _count: true,
            }),
            database_1.default.solidaryFund.findFirst(),
            database_1.default.platformConfig.findMany({
                where: { key: { in: ['commission_baobab_collection', 'commission_mentor', 'commission_guarantee', 'payin_repayment', 'return_min', 'withdrawal_fee_standard'] } },
            }),
        ]);
        const activeProjects = await database_1.default.project.count({ where: { status: 'ACTIVE' } });
        const feeMap = {};
        configRates.forEach(c => { feeMap[c.key] = c.value; });
        (0, helpers_1.successResponse)(res, {
            kpis: {
                totalUsers: userCount,
                totalRaised: projectStats._sum.raisedAmount || 0,
                activeProjects,
                totalProjects: projectStats._count,
            },
            fund: {
                totalReceived: fund?.totalReceived || 0,
                totalContributors: fund?.totalContributors || 0,
                totalProjects: fund?.totalProjects || 0,
            },
            config: configRates.map(c => ({ key: c.key, value: c.value })),
        });
    }
    catch (e) {
        console.error('[STATS PUBLIC]', e);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});
exports.default = router;
//# sourceMappingURL=statsPublic.js.map