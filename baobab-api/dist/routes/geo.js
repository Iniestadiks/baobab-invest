"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const country_state_city_1 = require("country-state-city");
const router = (0, express_1.Router)();
// Régions d'un pays
router.get('/states/:countryCode', (req, res) => {
    const states = country_state_city_1.State.getStatesOfCountry(req.params.countryCode);
    res.json({ success: true, data: states.map(s => ({ name: s.name, code: s.isoCode })) });
});
// Villes d'une région
router.get('/cities/:countryCode/:stateCode', (req, res) => {
    const cities = country_state_city_1.City.getCitiesOfState(req.params.countryCode, req.params.stateCode);
    res.json({ success: true, data: cities.map(c => c.name) });
});
exports.default = router;
// Taxonomie projets
const taxonomy_1 = require("../config/taxonomy");
router.get('/taxonomy', (_req, res) => {
    res.json({ success: true, data: taxonomy_1.PROJECT_TAXONOMY });
});
router.get('/taxonomy/:sector', (req, res) => {
    const sub = taxonomy_1.PROJECT_TAXONOMY[req.params.sector.toUpperCase()];
    if (!sub) {
        res.status(404).json({ success: false, message: 'Secteur introuvable' });
        return;
    }
    res.json({ success: true, data: sub });
});
// Vérifier disponibilité sous-secteur
router.get('/check-subsector/:sector/:subSector/:city', async (req, res) => {
    try {
        const { sector, subSector, city } = req.params;
        const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
        const prisma = new PrismaClient();
        const count = await prisma.project.count({
            where: {
                sector: sector,
                subSector: decodeURIComponent(subSector),
                city: { contains: decodeURIComponent(city), mode: 'insensitive' },
                status: { in: ['ACTIVE', 'FUNDED', 'IN_PROGRESS'] }
            }
        });
        const available = count < taxonomy_1.MAX_ACTIVE_PER_SUBSECTOR;
        const projects = available ? [] : await prisma.project.findMany({
            where: {
                sector: sector,
                subSector: decodeURIComponent(subSector),
                city: { contains: decodeURIComponent(city), mode: 'insensitive' },
                status: { in: ['ACTIVE', 'FUNDED'] }
            },
            select: { id: true, title: true, raisedAmount: true, goalAmount: true, status: true }
        });
        await prisma.$disconnect();
        res.json({ success: true, data: { available, count, max: taxonomy_1.MAX_ACTIVE_PER_SUBSECTOR, projects } });
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Erreur' });
    }
});
//# sourceMappingURL=geo.js.map