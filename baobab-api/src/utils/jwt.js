import jwt from 'jsonwebtoken';
import { config } from '../config';
export const generateAccessToken = (userId, role) => {
    return jwt.sign({ userId, role }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
    });
};
export const generateRefreshToken = (userId) => {
    return jwt.sign({ userId }, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiresIn,
    });
};
export const verifyRefreshToken = (token) => {
    return jwt.verify(token, config.jwt.refreshSecret);
};
