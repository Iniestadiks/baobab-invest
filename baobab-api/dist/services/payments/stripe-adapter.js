"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeProvider = void 0;
const API_KEY = process.env.STRIPE_SECRET_KEY || '';
exports.stripeProvider = {
    key: 'stripe',
    label: 'Stripe',
    methods: ['card'],
    async initPayin(data) {
        if (!API_KEY) {
            return { success: false, raw: { error: 'Stripe non configuré — ajoutez STRIPE_SECRET_KEY dans .env' } };
        }
        // TODO: créer une Stripe Checkout Session ici
        return { success: false, raw: { error: 'Intégration Stripe à finaliser' } };
    },
    async checkPayin(token) {
        return { success: false, status: 'not_implemented', raw: {} };
    },
};
//# sourceMappingURL=stripe-adapter.js.map