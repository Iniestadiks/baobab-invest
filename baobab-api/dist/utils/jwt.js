"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
// @ts-nocheck
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const generateAccessToken = (userId, role) => {
    return jsonwebtoken_1.default.sign({ userId, role }, config_1.config.jwt.secret, {
        expiresIn: config_1.config.jwt.expiresIn,
    });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, config_1.config.jwt.refreshSecret, {
        expiresIn: config_1.config.jwt.refreshExpiresIn,
    });
};
exports.generateRefreshToken = generateRefreshToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, config_1.config.jwt.refreshSecret);
};
exports.verifyRefreshToken = verifyRefreshToken;
//# sourceMappingURL=jwt.js.map