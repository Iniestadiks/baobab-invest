"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.userId || 'unknown';
        const typeMap = { document: 'identity', selfie: 'selfie', rccm: 'rccm' };
        const folder = `/home/baobab-invest/baobab-api/uploads/kyc/${userId}/${typeMap[file.fieldname] || 'other'}`;
        fs_1.default.mkdirSync(folder, { recursive: true });
        cb(null, folder);
    },
    filename: (req, file, cb) => {
        const userId = req.userId || 'unknown';
        const date = new Date().toISOString().split('T')[0];
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `${userId}-${file.fieldname}-${date}${ext}`);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.webp'];
        if (allowed.includes(path_1.default.extname(file.originalname).toLowerCase()))
            cb(null, true);
        else
            cb(new Error('Format non supporte'));
    }
});
router.post('/upload', auth_1.authenticate, upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'rccm', maxCount: 1 }
]), async (req, res) => {
    try {
        const files = req.files;
        const existing = await database_1.default.user.findUnique({ where: { id: req.userId } });
        if (existing?.kycStatus === 'PENDING') {
            res.status(400).json({ success: false, message: 'Une demande est deja en cours. Attendez la reponse de l\'administrateur.' });
            return;
        }
        if (existing?.kycStatus === 'VERIFIED') {
            res.status(400).json({ success: false, message: 'Votre KYC est deja verifie.' });
            return;
        }
        if (!files?.document || !files?.selfie) {
            res.status(400).json({ success: false, message: 'Document + selfie obligatoires' });
            return;
        }
        const userId = req.userId;
        const docUrl = `/uploads/kyc/${userId}/identity/${files.document[0].filename}`;
        const selfieUrl = `/uploads/kyc/${userId}/selfie/${files.selfie[0].filename}`;
        const rccmUrl = files.rccm ? `/uploads/kyc/${userId}/rccm/${files.rccm[0].filename}` : undefined;
        const expiry = req.body.documentExpiry ? new Date(req.body.documentExpiry) : undefined;
        const user = await database_1.default.user.update({
            where: { id: userId },
            data: {
                kycDocumentUrl: docUrl,
                kycSelfieUrl: selfieUrl,
                kycRccmUrl: rccmUrl,
                kycStatus: 'PENDING',
                kycSubmittedAt: new Date(),
                kycDocumentExpiry: expiry,
                kycDocumentType: req.body.documentType || 'CNI',
                kycAttempts: { increment: 1 },
                rccmNumber: req.body.rccmNumber || undefined,
                nineaNumber: req.body.nineaNumber || undefined,
            }
        });
        const admins = await database_1.default.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
            await database_1.default.notification.create({
                data: {
                    userId: admin.id,
                    title: 'Nouveau KYC a valider',
                    body: `${user.firstName} ${user.lastName} (${user.role}) a soumis ses documents KYC. Tentative #${user.kycAttempts}.`,
                    type: 'KYC_PENDING',
                    data: { userId: user.id }
                }
            });
        }
        (0, helpers_1.successResponse)(res, { docUrl, selfieUrl, rccmUrl }, 'Documents soumis. Verification sous 24h.');
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res, e.message || 'Erreur upload');
    }
});
router.get('/status', auth_1.authenticate, async (req, res) => {
    try {
        const user = await database_1.default.user.findUnique({
            where: { id: req.userId },
            select: {
                kycStatus: true, kycDocumentUrl: true, kycSelfieUrl: true,
                kycRccmUrl: true, kycVerifiedAt: true, kycSubmittedAt: true,
                kycRejectedReason: true, kycDocumentExpiry: true,
                kycDocumentType: true, kycAttempts: true
            }
        });
        (0, helpers_1.successResponse)(res, user);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.get('/admin/all', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { status, role } = req.query;
        const where = {};
        if (status && status !== 'ALL')
            where.kycStatus = status;
        if (role && role !== 'ALL')
            where.role = role;
        const users = await database_1.default.user.findMany({
            where,
            select: {
                id: true, firstName: true, lastName: true, email: true, role: true,
                city: true, country: true, phone: true,
                kycStatus: true, kycDocumentUrl: true, kycSelfieUrl: true,
                kycRccmUrl: true, kycSubmittedAt: true, kycVerifiedAt: true,
                kycRejectedReason: true, kycDocumentExpiry: true, kycDocumentType: true,
                kycAttempts: true, kycNotes: true, createdAt: true,
                reputationScore: true, level: true, referralCode: true,
                referralCount: true
            },
            orderBy: { createdAt: 'desc' }
        });
        const enriched = users.map(u => ({
            ...u,
            daysUntilExpiry: u.kycDocumentExpiry
                ? Math.ceil((new Date(u.kycDocumentExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null
        }));
        (0, helpers_1.successResponse)(res, enriched);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.patch('/admin/verify/:userId', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { action, reason, notes } = req.body;
        if (!['VERIFIED', 'REJECTED'].includes(action)) {
            res.status(400).json({ success: false, message: 'Action invalide' });
            return;
        }
        if (action === 'REJECTED' && !reason) {
            res.status(400).json({ success: false, message: 'Motif de rejet obligatoire' });
            return;
        }
        const user = await database_1.default.user.update({
            where: { id: req.params.userId },
            data: {
                kycStatus: action,
                kycVerifiedAt: action === 'VERIFIED' ? new Date() : null,
                kycRejectedReason: action === 'REJECTED' ? reason : null,
                kycVerifiedBy: req.userId,
                kycNotes: notes || null,
            }
        });
        await database_1.default.notification.create({
            data: {
                userId: user.id,
                title: action === 'VERIFIED' ? 'KYC Verifie !' : 'KYC Rejete',
                body: action === 'VERIFIED'
                    ? 'Votre identite a ete verifiee. Vous pouvez maintenant investir et soumettre des projets.'
                    : `Votre KYC a ete rejete. Motif : ${reason}. Vous pouvez soumettre de nouveaux documents.`,
                type: action === 'VERIFIED' ? 'KYC_VERIFIED' : 'KYC_REJECTED',
                data: { reason }
            }
        });
        (0, helpers_1.successResponse)(res, user, `KYC ${action === 'VERIFIED' ? 'valide' : 'rejete'}`);
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.get('/admin/dossier/:userId', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const user = await database_1.default.user.findUnique({ where: { id: req.params.userId } });
        if (!user) {
            res.status(404).json({ success: false });
            return;
        }
        const dir = `/home/baobab-invest/baobab-api/uploads/kyc/${req.params.userId}`;
        if (!fs_1.default.existsSync(dir)) {
            (0, helpers_1.successResponse)(res, { user: { id: user.id, name: `${user.firstName} ${user.lastName}`, role: user.role }, files: [] });
            return;
        }
        const files = [];
        const scanDir = (d, rel) => {
            fs_1.default.readdirSync(d).forEach(f => {
                const full = path_1.default.join(d, f);
                const relPath = path_1.default.join(rel, f);
                if (fs_1.default.statSync(full).isDirectory())
                    scanDir(full, relPath);
                else
                    files.push({
                        name: f,
                        folder: rel,
                        url: `/uploads/kyc/${req.params.userId}/${relPath}`,
                        size: fs_1.default.statSync(full).size,
                        modified: fs_1.default.statSync(full).mtime
                    });
            });
        };
        scanDir(dir, '');
        (0, helpers_1.successResponse)(res, {
            user: { id: user.id, name: `${user.firstName} ${user.lastName}`, role: user.role },
            files
        });
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
router.post('/check-expiry', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const now = new Date();
        const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const expired = await database_1.default.user.findMany({
            where: { kycStatus: 'VERIFIED', kycDocumentExpiry: { lt: now } }
        });
        for (const u of expired) {
            await database_1.default.user.update({ where: { id: u.id }, data: { kycStatus: 'PENDING' } });
            await database_1.default.notification.create({
                data: {
                    userId: u.id,
                    title: 'Document KYC expire',
                    body: 'Votre document d identite a expire. Soumettez un nouveau document.',
                    type: 'KYC_PENDING'
                }
            });
        }
        const expiringSoon = await database_1.default.user.findMany({
            where: { kycStatus: 'VERIFIED', kycDocumentExpiry: { gte: now, lte: in30days } }
        });
        for (const u of expiringSoon) {
            await database_1.default.notification.create({
                data: {
                    userId: u.id,
                    title: 'Document KYC expire bientot',
                    body: 'Votre document expire dans moins de 30 jours. Renouvelez-le.',
                    type: 'KYC_PENDING'
                }
            });
        }
        (0, helpers_1.successResponse)(res, { expired: expired.length, expiringSoon: expiringSoon.length });
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
//# sourceMappingURL=kyc.js.map