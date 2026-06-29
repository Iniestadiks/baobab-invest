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
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../config/database"));
const jwt_1 = require("../utils/jwt");
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
            return;
        }
        const user = await database_1.default.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ success: false, message: 'Identifiants invalides' });
            return;
        }
        if (!user.isActive || user.isBanned) {
            res.status(403).json({ success: false, message: 'Compte désactivé ou banni' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid) {
            res.status(401).json({ success: false, message: 'Identifiants invalides' });
            return;
        }
        const accessToken = (0, jwt_1.generateAccessToken)(user.id, user.role);
        const refreshToken = (0, jwt_1.generateRefreshToken)(user.id);
        // lastLoginAt non disponible
        (0, helpers_1.successResponse)(res, {
            accessToken, refreshToken,
            user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, kycStatus: user.kycStatus, profileImageUrl: user.profileImageUrl, level: user.level }
        }, 'Connexion réussie');
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, role, country, city, region, countryCode, indicatif, companyName, sector } = req.body;
        if (!email || !password || !firstName || !lastName) {
            res.status(400).json({ success: false, message: 'Champs obligatoires manquants' });
            return;
        }
        const existing = await database_1.default.user.findUnique({ where: { email } });
        if (existing) {
            res.status(409).json({ success: false, message: 'Email déjà utilisé' });
            return;
        }
        const hashed = await bcryptjs_1.default.hash(password, 10);
        const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        const user = await database_1.default.user.create({
            data: { email, password: hashed, firstName, lastName, phone, role: role || 'INVESTOR', referralCode, country: country || 'SN', city: city || '', region: region || '', countryCode: countryCode || 'SN', indicatif: indicatif || '+221' }
        });
        await database_1.default.wallet.create({ data: { userId: user.id, balance: 0 } });
        // Créer profil Bâtisseur si rôle BUILDER — pas de KYC requis
        if (role === 'BUILDER') {
            await database_1.default.builderProfile.create({
                data: { userId: user.id, companyName: companyName || null, sector: sector || null }
            });
            // Auto-valider KYC — les Bâtisseurs sont des donateurs, pas besoin de KYC
            await database_1.default.user.update({
                where: { id: user.id },
                data: { kycStatus: 'VERIFIED', isEmailVerified: true }
            });
            // Vérifier si le parrain devient Ambassadeur
            if (user.referredBy) {
                const { updateBuilderGamification } = await Promise.resolve().then(() => __importStar(require('../services/builderGamification')));
                await updateBuilderGamification(user.referredBy, { type: 'DON_FONDS', amount: 0 });
            }
        }
        const accessToken = (0, jwt_1.generateAccessToken)(user.id, user.role);
        const refreshToken = (0, jwt_1.generateRefreshToken)(user.id);
        (0, helpers_1.successResponse)(res, {
            accessToken, refreshToken,
            user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, kycStatus: user.kycStatus }
        }, 'Compte créé avec succès');
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Me
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await database_1.default.user.findUnique({
            where: { id: req.userId },
            include: { wallet: true }
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
            return;
        }
        (0, helpers_1.successResponse)(res, {
            id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
            role: user.role, kycStatus: user.kycStatus, profileImageUrl: user.profileImageUrl, level: user.level,
            phone: user.phone, city: user.city, country: user.country, region: user.region, countryCode: user.countryCode, indicatif: user.indicatif,
            totalInvested: user.totalInvested, reputationScore: user.reputationScore,
            wallet: user.wallet
        });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            res.status(400).json({ success: false, message: 'Refresh token manquant' });
            return;
        }
        const decoded = (0, jwt_1.verifyRefreshToken)(refreshToken);
        const user = await database_1.default.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.isActive) {
            res.status(401).json({ success: false, message: 'Token invalide' });
            return;
        }
        const accessToken = (0, jwt_1.generateAccessToken)(user.id, user.role);
        const newRefreshToken = (0, jwt_1.generateRefreshToken)(user.id);
        (0, helpers_1.successResponse)(res, { accessToken, refreshToken: newRefreshToken });
    }
    catch (e) {
        res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
    }
});
// Update profile
router.patch('/profile', auth_1.authenticate, async (req, res) => {
    try {
        const { firstName, lastName, phone, city, country, bio, region, countryCode, indicatif } = req.body;
        const user = await database_1.default.user.update({
            where: { id: req.userId },
            data: { firstName, lastName, phone, city, country, bio, region, countryCode, indicatif }
        });
        (0, helpers_1.successResponse)(res, user, 'Profil mis à jour');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// Upload avatar
router.patch('/avatar', auth_1.authenticate, async (req, res) => {
    try {
        const { avatarUrl } = req.body;
        const user = await database_1.default.user.update({ where: { id: req.userId }, data: { profileImageUrl: avatarUrl } });
        (0, helpers_1.successResponse)(res, { profileImageUrl: user.profileImageUrl }, 'Avatar mis à jour');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// Profil public d'un utilisateur
router.get('/profile/:userId', async (req, res) => {
    try {
        const user = await database_1.default.user.findUnique({
            where: { id: req.params.userId },
            select: {
                id: true, firstName: true, lastName: true, role: true,
                city: true, country: true, bio: true, profileImageUrl: true,
                reputationScore: true, reputationPoints: true, level: true, kycStatus: true, createdAt: true
            }
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
            return;
        }
        const projects = await database_1.default.project.findMany({
            where: user.role === 'MENTOR'
                ? { mentorId: req.params.userId, status: { in: ['ACTIVE', 'FUNDED', 'IN_PROGRESS', 'COMPLETED'] } }
                : { entrepreneurId: req.params.userId, status: { not: 'PENDING_REVIEW' } },
            select: { id: true, title: true, sector: true, city: true, raisedAmount: true, status: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: { ...user, projects } });
    }
    catch (e) {
        res.status(500).json({ success: false });
    }
});
// Liste des mentors certifiés disponibles
router.get('/mentors', async (req, res) => {
    try {
        const mentors = await database_1.default.user.findMany({
            where: { role: 'MENTOR', kycStatus: 'VERIFIED', isActive: true, isBanned: false },
            select: {
                id: true, firstName: true, lastName: true,
                city: true, country: true, reputationScore: true,
                level: true, bio: true, profileImageUrl: true
            },
            orderBy: { reputationScore: 'desc' }
        });
        res.json({ success: true, data: mentors });
    }
    catch (e) {
        res.status(500).json({ success: false });
    }
});
// PATCH /api/builder/profile — Mettre à jour profil Bâtisseur
router.patch('/builder/profile', auth_1.authenticate, async (req, res) => {
    try {
        const { companyName, sector, description, website, country, isPublic } = req.body;
        const profile = await database_1.default.builderProfile.upsert({
            where: { userId: req.userId },
            create: { userId: req.userId, companyName, sector, description, website, country, isPublic },
            update: { companyName, sector, description, website, country, isPublic, updatedAt: new Date() }
        });
        (0, helpers_1.successResponse)(res, profile, 'Profil Bâtisseur mis à jour');
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map