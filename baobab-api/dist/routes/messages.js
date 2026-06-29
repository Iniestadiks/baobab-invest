"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
// Envoyer un message (lié à un projet ou non)
router.post('/send', auth_1.authenticate, async (req, res) => {
    try {
        const { toUserId, content, projectId } = req.body;
        if (!toUserId || !content?.trim()) {
            res.status(400).json({ success: false, message: 'Destinataire et message obligatoires' });
            return;
        }
        if (content.trim().length < 5) {
            res.status(400).json({ success: false, message: 'Message trop court (min 5 caractères)' });
            return;
        }
        const recipient = await database_1.default.user.findUnique({ where: { id: toUserId }, select: { id: true, firstName: true, role: true } });
        if (!recipient) {
            res.status(404).json({ success: false, message: 'Destinataire introuvable' });
            return;
        }
        const sender = await database_1.default.user.findUnique({ where: { id: req.userId }, select: { firstName: true, lastName: true } });
        const message = await database_1.default.message.create({
            data: {
                fromUserId: req.userId,
                toUserId,
                content: content.trim(),
                projectId: projectId || null,
            },
            include: {
                fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
                toUser: { select: { id: true, firstName: true, lastName: true, role: true } },
                project: { select: { id: true, title: true } },
            }
        });
        // Notification au destinataire
        await database_1.default.notification.create({
            data: {
                userId: toUserId,
                title: `💬 Message de ${sender?.firstName} ${sender?.lastName}`,
                body: content.substring(0, 80) + (content.length > 80 ? '...' : ''),
                type: 'MESSAGE',
                data: { fromUserId: req.userId, projectId: projectId || null }
            }
        });
        (0, helpers_1.successResponse)(res, message, 'Message envoyé');
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Mes conversations (liste des contacts avec dernier message)
router.get('/conversations', auth_1.authenticate, async (req, res) => {
    try {
        const messages = await database_1.default.message.findMany({
            where: {
                OR: [{ fromUserId: req.userId }, { toUserId: req.userId }]
            },
            include: {
                fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
                toUser: { select: { id: true, firstName: true, lastName: true, role: true } },
                project: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'desc' }
        });
        // Grouper par conversation (avec chaque contact)
        const conversations = {};
        for (const msg of messages) {
            const otherUser = msg.fromUserId === req.userId ? msg.toUser : msg.fromUser;
            const key = otherUser.id;
            if (!conversations[key]) {
                const unreadCount = await database_1.default.message.count({
                    where: { fromUserId: otherUser.id, toUserId: req.userId, isRead: false }
                });
                conversations[key] = {
                    contact: otherUser,
                    lastMessage: msg,
                    unreadCount,
                    projectId: msg.projectId,
                    project: msg.project,
                };
            }
        }
        (0, helpers_1.successResponse)(res, Object.values(conversations));
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Messages d'une conversation
router.get('/with/:userId', auth_1.authenticate, async (req, res) => {
    try {
        const { projectId } = req.query;
        const where = {
            OR: [
                { fromUserId: req.userId, toUserId: req.params.userId },
                { fromUserId: req.params.userId, toUserId: req.userId },
            ]
        };
        if (projectId)
            where.projectId = String(projectId);
        const messages = await database_1.default.message.findMany({
            where,
            include: {
                fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
                project: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'asc' }
        });
        // Marquer comme lus
        await database_1.default.message.updateMany({
            where: { fromUserId: req.params.userId, toUserId: req.userId, isRead: false },
            data: { isRead: true }
        });
        const contact = await database_1.default.user.findUnique({
            where: { id: req.params.userId },
            select: { id: true, firstName: true, lastName: true, role: true, city: true, reputationScore: true }
        });
        (0, helpers_1.successResponse)(res, { messages, contact });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Nombre de messages non lus
router.get('/unread-count', auth_1.authenticate, async (req, res) => {
    try {
        const count = await database_1.default.message.count({
            where: { toUserId: req.userId, isRead: false }
        });
        (0, helpers_1.successResponse)(res, { count });
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Message groupé entrepreneur → tous ses investisseurs
router.post('/broadcast/:projectId', auth_1.authenticate, (0, auth_1.requireRole)(['ENTREPRENEUR']), async (req, res) => {
    try {
        const { projectId } = req.params;
        const { content: msgContent } = req.body;
        if (!msgContent || msgContent.trim().length < 10) {
            res.status(400).json({ success: false, message: 'Message trop court (minimum 10 caractères)' });
            return;
        }
        const project = await database_1.default.project.findUnique({
            where: { id: projectId },
            include: { investments: { select: { userId: true } } }
        });
        if (!project || project.entrepreneurId !== req.userId) {
            res.status(403).json({ success: false, message: 'Non autorisé' });
            return;
        }
        // Vérifier limite 7 jours
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentBroadcast = await database_1.default.message.findFirst({
            where: {
                fromUserId: req.userId,
                projectId,
                type: 'BROADCAST',
                createdAt: { gte: sevenDaysAgo }
            }
        });
        if (recentBroadcast) {
            const nextDate = new Date(recentBroadcast.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
            const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            res.status(429).json({ success: false, message: `Limite atteinte. Prochain envoi possible dans ${daysLeft} jour(s)` });
            return;
        }
        // Investisseurs uniques
        const investorIds = [...new Set(project.investments.map(i => i.userId))];
        if (investorIds.length === 0) {
            res.status(400).json({ success: false, message: 'Aucun investisseur pour ce projet' });
            return;
        }
        // Créer les messages + notifications
        const messagesData = investorIds.map(userId => ({
            fromUserId: req.userId,
            toUserId: userId,
            content: `📢 [${project.title}] ${msgContent}`,
            projectId,
            type: 'BROADCAST',
        }));
        await database_1.default.message.createMany({ data: messagesData });
        // Notifications
        await database_1.default.notification.createMany({
            data: investorIds.map(userId => ({
                userId,
                title: `📢 Message de ${project.title}`,
                body: msgContent.substring(0, 100) + (msgContent.length > 100 ? '...' : ''),
                type: 'FEED_UPDATE',
                data: { projectId }
            }))
        });
        // Créer aussi un post dans le feed — remet à zéro le compteur 21j
        await database_1.default.post.create({
            data: {
                projectId,
                authorId: req.userId,
                content: msgContent,
                type: 'UPDATE',
            }
        });
        // Réduire score réputation si inactivité — annuler la pénalité récente
        await database_1.default.user.update({
            where: { id: req.userId },
            data: { reputationScore: { increment: 2 } }
        }).catch(() => { });
        (0, helpers_1.successResponse)(res, { sentTo: investorIds.length }, `Message envoyé à ${investorIds.length} investisseur(s)`);
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
// Upload pièce jointe dans un message
router.post('/upload-attachment', auth_1.authenticate, async (req, res) => {
    try {
        const multer = require('multer');
        const path = require('path');
        const fs = require('fs');
        const storage = multer.diskStorage({
            destination: (r, f, cb) => {
                const dir = '/home/baobab-invest/baobab-api/uploads/messages';
                if (!fs.existsSync(dir))
                    fs.mkdirSync(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (r, f, cb) => {
                cb(null, `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${path.extname(f.originalname)}`);
            }
        });
        const upload = multer({
            storage,
            limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
            fileFilter: (r, f, cb) => {
                const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx'];
                const ext = path.extname(f.originalname).toLowerCase();
                if (allowed.includes(ext))
                    cb(null, true);
                else
                    cb(new Error('Format non supporté'));
            }
        }).single('file');
        upload(req, res, async (err) => {
            if (err) {
                res.status(400).json({ success: false, message: err.message });
                return;
            }
            if (!req.file) {
                res.status(400).json({ success: false, message: 'Aucun fichier' });
                return;
            }
            const fileUrl = `/uploads/messages/${req.file.filename}`;
            const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(req.file.originalname).toLowerCase());
            (0, helpers_1.successResponse)(res, {
                url: fileUrl,
                name: req.file.originalname,
                size: req.file.size,
                isImage,
                type: req.file.mimetype
            }, 'Fichier uploadé');
        });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
//# sourceMappingURL=messages.js.map