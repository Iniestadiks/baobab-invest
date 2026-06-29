import bcrypt from 'bcryptjs';
export const hashPassword = async (password) => {
    return bcrypt.hash(password, 12);
};
export const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};
export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
export const generateReference = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `BAOBAB-${timestamp}-${random}`;
};
export const successResponse = (res, data, message = 'Succès', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};
export const errorResponse = (res, message = 'Erreur serveur', statusCode = 500) => {
    return res.status(statusCode).json({
        success: false,
        message,
    });
};
