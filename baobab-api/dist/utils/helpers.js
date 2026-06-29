"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorResponse = exports.successResponse = exports.generateReference = exports.generateOTP = exports.comparePassword = exports.hashPassword = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const hashPassword = async (password) => {
    return bcryptjs_1.default.hash(password, 12);
};
exports.hashPassword = hashPassword;
const comparePassword = async (password, hash) => {
    return bcryptjs_1.default.compare(password, hash);
};
exports.comparePassword = comparePassword;
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.generateOTP = generateOTP;
const generateReference = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `BAOBAB-${timestamp}-${random}`;
};
exports.generateReference = generateReference;
const successResponse = (res, data, message = 'Succès', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};
exports.successResponse = successResponse;
const errorResponse = (res, message = 'Erreur serveur', statusCode = 500) => {
    return res.status(statusCode).json({
        success: false,
        message,
    });
};
exports.errorResponse = errorResponse;
//# sourceMappingURL=helpers.js.map