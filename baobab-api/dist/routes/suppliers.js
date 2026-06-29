"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
const supplierSchema = zod_1.z.object({
    companyName: zod_1.z.string().min(2),
    contactName: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(8),
    sector: zod_1.z.string(),
    city: zod_1.z.string(),
    country: zod_1.z.string().default('SN'),
    rccmNumber: zod_1.z.string().optional(),
    nineaNumber: zod_1.z.string().optional(),
    mobileMoneyNumber: zod_1.z.string().min(8),
    mobileMoneyProvider: zod_1.z.enum(['WAVE', 'ORANGE', 'MTN', 'MOOV', 'FREE']),
    description: zod_1.z.string().optional(),
});
// Enregistrer un fournisseur (public)
router.post('/register', async (req, res) => {
    try {
        const { password, confirmPassword, ...rest } = req.body;
        const data = supplierSchema.parse(rest);
        const existing = await database_1.default.supplier.findFirst({
            where: { OR: [{ email: data.email }, { phone: data.phone }] }
        });
        if (existing) {
            res.status(400).json({ success: false, message: 'Email ou telephone deja enregistre' });
            return;
        }
        if (!password || password.length < 6) {
            res.status(400).json({ success: false, message: 'Mot de passe minimum 6 caracteres' });
            return;
        }
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
        const hashedPassword = await bcrypt.default.hash(password, 10);
        const supplier = await database_1.default.supplier.create({ data: { ...data, password: hashedPassword } });
        (0, helpers_1.successResponse)(res, { id: supplier.id, companyName: supplier.companyName, email: supplier.email }, 'Demande soumise — en attente de verification KYB', 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, message: error.errors[0].message });
            return;
        }
        (0, helpers_1.errorResponse)(res);
    }
});
// Liste TOUS les fournisseurs (admin seulement)
router.get('/admin/all', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const suppliers = await database_1.default.supplier.findMany({
            orderBy: [{ isVerified: 'asc' }, { createdAt: 'desc' }],
        });
        (0, helpers_1.successResponse)(res, suppliers);
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Liste des fournisseurs vérifiés (public)
router.get('/', async (req, res) => {
    try {
        const { sector, country, search } = req.query;
        const suppliers = await database_1.default.supplier.findMany({
            where: {
                isVerified: true,
                status: 'VERIFIED',
                ...(sector ? { sector: String(sector) } : {}),
                ...(country ? { country: String(country) } : {}),
                ...(search ? {
                    OR: [
                        { companyName: { contains: String(search), mode: 'insensitive' } },
                        { description: { contains: String(search), mode: 'insensitive' } },
                    ]
                } : {}),
            },
            orderBy: [{ isPremium: 'desc' }, { rating: 'desc' }],
            select: {
                id: true, companyName: true, contactName: true,
                sector: true, city: true, country: true,
                mobileMoneyProvider: true, description: true,
                logoUrl: true, isPremium: true, rating: true,
            }
        });
        (0, helpers_1.successResponse)(res, suppliers);
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Détail fournisseur
router.get('/:id', async (req, res) => {
    try {
        const supplier = await database_1.default.supplier.findUnique({
            where: { id: req.params.id },
            include: {
                milestonePayments: {
                    select: { amount: true, status: true, paidAt: true },
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!supplier || !supplier.isVerified) {
            res.status(404).json({ success: false, message: 'Fournisseur introuvable' });
            return;
        }
        (0, helpers_1.successResponse)(res, supplier);
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Admin — vérifier un fournisseur (KYB)
router.patch('/:id/verify', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const supplier = await database_1.default.supplier.update({
            where: { id: req.params.id },
            data: { status: 'VERIFIED', isVerified: true, verifiedAt: new Date() }
        });
        (0, helpers_1.successResponse)(res, supplier, 'Fournisseur vérifié avec succès');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Admin — suspendre un fournisseur
router.patch('/:id/suspend', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const supplier = await database_1.default.supplier.update({
            where: { id: req.params.id },
            data: { status: 'SUSPENDED', isVerified: false }
        });
        (0, helpers_1.successResponse)(res, supplier, 'Fournisseur suspendu');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
// Fournisseur par email (pour son espace dédié)
router.get('/by-email/:email', async (req, res) => {
    try {
        const supplier = await database_1.default.supplier.findFirst({
            where: { email: decodeURIComponent(req.params.email) }
        });
        if (!supplier) {
            res.status(404).json({ success: false, message: 'Fournisseur introuvable' });
            return;
        }
        const payments = await database_1.default.milestonePayment.findMany({
            where: { supplierId: supplier.id },
            include: {
                milestone: {
                    select: {
                        title: true,
                        project: { select: { title: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        (0, helpers_1.successResponse)(res, { supplier, payments });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Auth fournisseur — login
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
            return;
        }
        const supplier = await database_1.default.supplier.findUnique({ where: { email } });
        if (!supplier) {
            res.status(404).json({ success: false, message: 'Compte fournisseur introuvable' });
            return;
        }
        if (!supplier.password) {
            res.status(400).json({ success: false, message: 'Mot de passe non configuré — contactez BAOBAB INVEST' });
            return;
        }
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
        const valid = await bcrypt.default.compare(password, supplier.password);
        if (!valid) {
            res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
            return;
        }
        await database_1.default.supplier.update({ where: { id: supplier.id }, data: { lastLoginAt: new Date() } });
        const jwt = await Promise.resolve().then(() => __importStar(require('jsonwebtoken')));
        const token = jwt.default.sign({ supplierId: supplier.id, email: supplier.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.json({ success: true, data: { token, supplier: { id: supplier.id, companyName: supplier.companyName, email: supplier.email, isVerified: supplier.isVerified, mobileMoneyProvider: supplier.mobileMoneyProvider, mobileMoneyNumber: supplier.mobileMoneyNumber } } });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Admin — définir mot de passe fournisseur
router.post('/:id/set-password', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) {
            res.status(400).json({ success: false, message: 'Mot de passe minimum 6 caractères' });
            return;
        }
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
        const hashed = await bcrypt.default.hash(password, 10);
        await database_1.default.supplier.update({ where: { id: req.params.id }, data: { password: hashed } });
        res.json({ success: true, message: 'Mot de passe défini avec succès' });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Fournisseur connecté — ses paiements
router.get('/my-payments', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            res.status(401).json({ success: false, message: 'Non autorisé' });
            return;
        }
        const jwt = await Promise.resolve().then(() => __importStar(require('jsonwebtoken')));
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'secret');
        const payments = await database_1.default.milestonePayment.findMany({
            where: { supplierId: decoded.supplierId },
            include: { milestone: { include: { project: { select: { title: true } } } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: payments });
    }
    catch (e) {
        res.status(401).json({ success: false, message: 'Token invalide' });
    }
});
//# sourceMappingURL=suppliers.js.map