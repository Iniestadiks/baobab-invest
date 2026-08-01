"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kiakiapayProvider = void 0;
const API_KEY = process.env.KIAKIAPAY_API_KEY || '';
exports.kiakiapayProvider = {
    key: 'kiakiapay',
    label: 'KiaKiaPay',
    methods: ['mobile_money'],
    async initPayin(data) {
        if (!API_KEY) {
            return { success: false, raw: { error: 'KiaKiaPay non configuré — ajoutez KIAKIAPAY_API_KEY dans .env' } };
        }
        // TODO: appel réel à l'API KiaKiaPay
        return { success: false, raw: { error: 'Intégration KiaKiaPay à finaliser' } };
    },
    async checkPayin(token) {
        return { success: false, status: 'not_implemented', raw: {} };
    },
    async initPayout(data) {
        return { success: false, raw: { error: 'Intégration KiaKiaPay à finaliser' } };
    },
};
//# sourceMappingURL=kiakiapay-adapter.js.map