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
// Feed d'un projet (privé — investisseurs seulement)
router.get('/project/:projectId', auth_1.authenticate, async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const investment = await database_1.default.investment.findFirst({
            where: { projectId, userId: req.userId }
        });
        const project = await database_1.default.project.findUnique({ where: { id: projectId } });
        const isEntrepreneur = project?.entrepreneurId === req.userId;
        const isMentor = project?.mentorId === req.userId;
        if (!investment && !isEntrepreneur && !isMentor) {
            res.status(403).json({ success: false, message: 'Accès réservé aux investisseurs de ce projet' });
            return;
        }
        const posts = await database_1.default.post.findMany({
            where: { projectId },
            include: {
                author: { select: { firstName: true, lastName: true, profileImageUrl: true, role: true } },
                reactions: { where: { userId: req.userId }, select: { type: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        (0, helpers_1.successResponse)(res, posts);
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Publier un post (entrepreneur)
router.post('/project/:projectId', auth_1.authenticate, async (req, res) => {
    try {
        const { content, mediaUrls } = req.body;
        const projectId = req.params.projectId;
        const project = await database_1.default.project.findUnique({ where: { id: projectId } });
        if (!project || project.entrepreneurId !== req.userId) {
            res.status(403).json({ success: false, message: 'Non autorisé' });
            return;
        }
        if (!content || content.length < 20) {
            res.status(400).json({ success: false, message: 'Le post doit faire au moins 20 caractères' });
            return;
        }
        const post = await database_1.default.post.create({
            data: { authorId: req.userId, projectId, content, mediaUrls: mediaUrls || [] },
            include: { author: { select: { firstName: true, lastName: true } } }
        });
        // Notifier tous les investisseurs
        const investors = await database_1.default.investment.findMany({
            where: { projectId },
            select: { userId: true }
        });
        const uniqueInvestors = [...new Set(investors.map(i => i.userId))];
        await database_1.default.notification.createMany({
            data: uniqueInvestors.map(userId => ({
                userId,
                title: '📸 Nouvelle mise à jour',
                body: `${project.title} : ${content.substring(0, 60)}...`,
                type: 'FEED_UPDATE',
                data: { projectId, postId: post.id }
            }))
        });
        (0, helpers_1.successResponse)(res, post, 'Post publié', 201);
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// Réagir à un post
router.post('/post/:postId/react', auth_1.authenticate, async (req, res) => {
    try {
        const { type } = req.body;
        if (!['TRUST', 'WORRY', 'BRAVO'].includes(type)) {
            res.status(400).json({ success: false, message: 'Réaction invalide' });
            return;
        }
        const postId = req.params.postId;
        const existing = await database_1.default.postReaction.findUnique({
            where: { postId_userId: { postId, userId: req.userId } }
        });
        if (existing) {
            if (existing.type === type) {
                await database_1.default.postReaction.delete({ where: { postId_userId: { postId, userId: req.userId } } });
                const field = type === 'TRUST' ? 'trustCount' : type === 'WORRY' ? 'worryCount' : 'bravoCount';
                await database_1.default.post.update({ where: { id: postId }, data: { [field]: { decrement: 1 } } });
                (0, helpers_1.successResponse)(res, null, 'Réaction retirée');
                return;
            }
            const oldField = existing.type === 'TRUST' ? 'trustCount' : existing.type === 'WORRY' ? 'worryCount' : 'bravoCount';
            const newField = type === 'TRUST' ? 'trustCount' : type === 'WORRY' ? 'worryCount' : 'bravoCount';
            await database_1.default.postReaction.update({ where: { postId_userId: { postId, userId: req.userId } }, data: { type } });
            await database_1.default.post.update({ where: { id: postId }, data: { [oldField]: { decrement: 1 }, [newField]: { increment: 1 } } });
        }
        else {
            await database_1.default.postReaction.create({ data: { postId, userId: req.userId, type } });
            const field = type === 'TRUST' ? 'trustCount' : type === 'WORRY' ? 'worryCount' : 'bravoCount';
            await database_1.default.post.update({ where: { id: postId }, data: { [field]: { increment: 1 } } });
        }
        (0, helpers_1.successResponse)(res, null, 'Réaction enregistrée');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
//# sourceMappingURL=feed.js.map