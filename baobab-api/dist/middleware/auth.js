"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAdmin = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const database_1 = __importDefault(require("../config/database"));
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ success: false, message: 'Token manquant' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        const user = await database_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, role: true, isActive: true, isBanned: true },
        });
        if (!user || !user.isActive || user.isBanned) {
            res.status(401).json({ success: false, message: 'Compte non autorisé' });
            return;
        }
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        next();
    }
    catch {
        res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
    }
};
exports.authenticate = authenticate;
const requireAdmin = (req, res, next) => {
    if (req.userRole !== 'ADMIN') {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.userRole || !roles.includes(req.userRole)) {
            res.status(403).json({ success: false, message: 'Accès refusé' });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.js.map