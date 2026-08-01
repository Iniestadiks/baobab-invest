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
const academyCourses_1 = require("../config/academyCourses");
const reputationService_1 = require("../services/reputationService");
const router = (0, express_1.Router)();
// Liste des cours disponibles pour le rôle de l'utilisateur, avec statut de complétion
router.get('/courses', auth_1.authenticate, async (req, res) => {
    try {
        const user = await database_1.default.user.findUnique({ where: { id: req.userId }, select: { role: true } });
        const courses = (0, academyCourses_1.getCoursesForRole)(user?.role || 'ALL');
        const completions = await database_1.default.courseCompletion.findMany({
            where: { userId: req.userId },
            select: { courseId: true, completedAt: true }
        });
        const completedMap = {};
        completions.forEach(c => { completedMap[c.courseId] = c.completedAt; });
        const enriched = courses.map(c => ({
            ...c,
            completed: !!completedMap[c.id],
            completedAt: completedMap[c.id] || null,
        }));
        (0, helpers_1.successResponse)(res, {
            courses: enriched,
            totalCertified: enriched.filter(c => c.certified).length,
            completedCertified: enriched.filter(c => c.certified && c.completed).length,
        });
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
// Détail d'un cours (contenu de la leçon)
router.get('/courses/:id', auth_1.authenticate, async (req, res) => {
    try {
        const course = (0, academyCourses_1.getCourse)(req.params.id);
        if (!course) {
            res.status(404).json({ success: false, message: 'Cours introuvable' });
            return;
        }
        const completion = await database_1.default.courseCompletion.findUnique({
            where: { userId_courseId: { userId: req.userId, courseId: course.id } }
        });
        (0, helpers_1.successResponse)(res, { ...course, completed: !!completion });
    }
    catch (e) {
        (0, helpers_1.errorResponse)(res);
    }
});
// Marquer un cours comme terminé — attribue les points réels
router.post('/complete/:id', auth_1.authenticate, async (req, res) => {
    try {
        const course = (0, academyCourses_1.getCourse)(req.params.id);
        if (!course) {
            res.status(404).json({ success: false, message: 'Cours introuvable' });
            return;
        }
        const existing = await database_1.default.courseCompletion.findUnique({
            where: { userId_courseId: { userId: req.userId, courseId: course.id } }
        });
        if (existing) {
            (0, helpers_1.successResponse)(res, { alreadyCompleted: true }, 'Cours déjà marqué comme terminé');
            return;
        }
        await database_1.default.courseCompletion.create({
            data: { userId: req.userId, courseId: course.id, pointsEarned: course.certified ? course.points : 0 }
        });
        // Points de réputation réels (gamification) — pour tous les rôles
        if (course.points > 0) {
            await (0, reputationService_1.addReputationPoints)(req.userId, 'COURSE_COMPLETED', course.points, `Cours terminé : ${course.title}`, undefined);
        }
        await database_1.default.notification.create({
            data: {
                userId: req.userId,
                title: course.certified ? '🏆 Cours certifiant terminé !' : '📚 Cours terminé !',
                body: `"${course.title}" — +${course.points} pts${course.certified ? ' (compte pour votre score de bankabilité si vous soumettez un projet)' : ''}`,
                type: 'COURSE_COMPLETED',
                data: JSON.stringify({ courseId: course.id, points: course.points })
            }
        });
        (0, helpers_1.successResponse)(res, { pointsEarned: course.points, certified: course.certified }, `Cours terminé — +${course.points} pts !`);
    }
    catch (e) {
        console.error(e);
        (0, helpers_1.errorResponse)(res);
    }
});
exports.default = router;
//# sourceMappingURL=academy.js.map