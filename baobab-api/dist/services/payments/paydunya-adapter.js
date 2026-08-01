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
exports.paydunyaProvider = void 0;
// @ts-nocheck
// Adaptateur PayDunya — enveloppe le service existant (src/services/paydunya.ts)
// sans le modifier, pour qu'il respecte l'interface commune PaymentProvider.
const paydunya = __importStar(require("../paydunya"));
exports.paydunyaProvider = {
    key: 'paydunya',
    label: 'PayDunya',
    methods: ['mobile_money'],
    async initPayin(data) {
        const raw = await paydunya.initPayin(data);
        return {
            success: raw?.response_code === '00',
            redirectUrl: raw?.response_text, // URL de la page de paiement PayDunya
            token: raw?.token,
            raw,
        };
    },
    async checkPayin(token) {
        const raw = await paydunya.checkPayin(token);
        return {
            success: raw?.response_code === '00' && raw?.status === 'completed',
            status: raw?.status || 'unknown',
            raw,
        };
    },
    async initPayout(data) {
        const raw = await paydunya.initPayout(data);
        return { success: raw?.response_code === '00' || raw?.success === true, raw };
    },
    async checkBalance() {
        const raw = await paydunya.checkBalance();
        return { balance: Number(raw?.balance || 0), raw };
    },
};
//# sourceMappingURL=paydunya-adapter.js.map