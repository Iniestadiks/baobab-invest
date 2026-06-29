import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
const router = Router();
const prisma = new PrismaClient();
// Config Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Multer — stockage en mémoire (pas sur disque)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Format vidéo non supporté. Utilisez MP4, MOV, AVI ou WebM.'));
        }
    }
});
const successResponse = (res, data, message = 'OK') => res.json({ success: true, data, message });
const errorResponse = (res, message = 'Erreur serveur', code = 500) => res.status(code).json({ success: false, message });
// ─── UPLOAD PITCH VIDEO ──────────────────────────────────────────────────────
router.post('/pitch-video', authenticate, upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            errorResponse(res, 'Aucun fichier vidéo reçu', 400);
            return;
        }
        const MAX_DURATION = 105; // 1 min 45 sec
        // Upload vers Cloudinary depuis le buffer mémoire
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({
                resource_type: 'video',
                folder: 'baobab-invest/pitch-videos',
                // Pas de transformation synchrone — trop lent pour grandes vidéos
                eager: [{ format: 'mp4', quality: 'auto:low' }],
                eager_async: true, // traitement asynchrone obligatoire pour grandes vidéos
                chunk_size: 6000000, // upload par chunks de 6MB
                tags: [`user-${req.userId}`, 'pitch-video', 'baobab-invest'],
                context: `uploaded_by=${req.userId}|platform=baobab-invest`,
            }, (error, result) => {
                if (error)
                    reject(error);
                else
                    resolve(result);
            });
            stream.end(req.file.buffer);
        });
        // Vérifier la durée réelle de la vidéo
        const duration = uploadResult.duration || 0;
        if (duration > MAX_DURATION) {
            // Supprimer la vidéo trop longue
            await cloudinary.uploader.destroy(uploadResult.public_id, { resource_type: 'video' });
            errorResponse(res, `Vidéo trop longue (${Math.round(duration)}s). Maximum : 1 minute 45 secondes (105s).`, 400);
            return;
        }
        // URL sécurisée et permanente
        const videoUrl = uploadResult.secure_url;
        const publicId = uploadResult.public_id;
        const thumbnailUrl = cloudinary.url(publicId, {
            resource_type: 'video',
            format: 'jpg',
            transformation: [{ width: 640, height: 360, crop: 'fill', start_offset: '2' }]
        });
        console.log(`✅ Pitch vidéo uploadée par ${req.userId}: ${videoUrl} (${Math.round(duration)}s)`);
        successResponse(res, {
            videoUrl,
            publicId,
            thumbnailUrl,
            duration: Math.round(duration),
            format: uploadResult.format,
            size: uploadResult.bytes,
        }, `Vidéo uploadée avec succès (${Math.round(duration)}s)`);
    }
    catch (e) {
        console.error('Upload error:', e);
        errorResponse(res, e.message || 'Erreur lors de l\'upload de la vidéo');
    }
});
// ─── SUPPRIMER VIDÉO (admin seulement) ──────────────────────────────────────
router.delete('/pitch-video/:publicId', authenticate, async (req, res) => {
    try {
        // Vérifier que c'est un admin
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (user?.role !== 'ADMIN') {
            errorResponse(res, 'Accès non autorisé', 403);
            return;
        }
        const publicId = decodeURIComponent(req.params.publicId);
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
        successResponse(res, {}, 'Vidéo supprimée');
    }
    catch (e) {
        errorResponse(res);
    }
});
export default router;
