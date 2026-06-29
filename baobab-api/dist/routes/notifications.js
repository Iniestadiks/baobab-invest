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
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const notifications = await database_1.default.notification.findMany({
            where: { userId: req.userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        const unreadCount = await database_1.default.notification.count({ where: { userId: req.userId, isRead: false } });
        (0, helpers_1.successResponse)(res, { notifications, unreadCount });
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
router.patch('/read-all', auth_1.authenticate, async (req, res) => {
    try {
        await database_1.default.notification.updateMany({ where: { userId: req.userId, isRead: false }, data: { isRead: true } });
        (0, helpers_1.successResponse)(res, null, 'Notifications marquées comme lues');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
// POST /:id/read — marquer une notif comme lue (alternative PATCH)
router.post('/:id/read', auth_1.authenticate, async (req, res) => {
    try {
        await database_1.default.notification.updateMany({
            where: { id: req.params.id, userId: req.userId },
            data: { isRead: true }
        });
        (0, helpers_1.successResponse)(res, {}, 'Lu');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// POST /:id/delete — supprimer une notification
router.post('/:id/delete', auth_1.authenticate, async (req, res) => {
    try {
        await database_1.default.notification.deleteMany({
            where: { id: req.params.id, userId: req.userId }
        });
        (0, helpers_1.successResponse)(res, {}, 'Supprimée');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// DELETE /:id — supprimer une notification (REST)
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        await database_1.default.notification.deleteMany({
            where: { id: req.params.id, userId: req.userId }
        });
        (0, helpers_1.successResponse)(res, {}, 'Supprimée');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// POST /read-all — marquer toutes comme lues
router.post('/read-all', auth_1.authenticate, async (req, res) => {
    try {
        await database_1.default.notification.updateMany({
            where: { userId: req.userId, isRead: false },
            data: { isRead: true }
        });
        (0, helpers_1.successResponse)(res, {}, 'Toutes lues');
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
// Marquer une notification spécifique comme lue
router.patch('/:id/read', auth_1.authenticate, async (req, res) => {
    try {
        await database_1.default.notification.update({
            where: { id: req.params.id, userId: req.userId },
            data: { isRead: true }
        });
        (0, helpers_1.successResponse)(res, null, 'Lu');
    }
    catch {
        (0, helpers_1.errorResponse)(res);
    }
});
//# sourceMappingURL=notifications.js.map