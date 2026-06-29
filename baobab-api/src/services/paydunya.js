// Service PayDunya — Payin et Payout
const MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY || '';
const PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY || '';
const TOKEN = process.env.PAYDUNYA_TOKEN || '';
const MODE = process.env.PAYDUNYA_MODE || 'test';
const BASE_URL = MODE === 'live'
    ? 'https://app.paydunya.com/api/v1'
    : 'https://app.paydunya.com/sandbox-api/v1';
const HEADERS = {
    'PAYDUNYA-MASTER-KEY': MASTER_KEY,
    'PAYDUNYA-PRIVATE-KEY': PRIVATE_KEY,
    'PAYDUNYA-TOKEN': TOKEN,
    'Content-Type': 'application/json'
};
// Initier un paiement (Payin) — dépôt wallet
export async function initPayin(data) {
    const body = {
        invoice: {
            total_amount: data.amount,
            description: data.description,
        },
        store: {
            name: 'KORAPACT',
            tagline: 'Plateforme de micro-investissement',
            postal_address: 'Dakar, Senegal',
            website_url: process.env.FRONTEND_URL || 'http://46.202.132.161:3000',
            logo_url: '',
            phone: '',
        },
        actions: {
            callback_url: data.callbackUrl,
            return_url: data.returnUrl,
            cancel_url: data.cancelUrl,
        },
        customer: {
            name: data.customerName,
            email: data.customerEmail,
            phone: data.customerPhone,
        },
        custom_data: data.customData || {}
    };
    const res = await fetch(`${BASE_URL}/checkout-invoice/create`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body)
    });
    return res.json();
}
// Vérifier le statut d'un paiement
export async function checkPayin(token) {
    const res = await fetch(`${BASE_URL}/checkout-invoice/confirm/${token}`, {
        headers: HEADERS
    });
    return res.json();
}
// Envoyer un virement (Payout) — retrait wallet
export async function initPayout(data) {
    const operatorMap = {
        'Orange Money': 'ORANGE_MONEY_SENEGAL',
        'Wave': 'WAVE_SENEGAL',
        'Free Money': 'FREE_MONEY_SENEGAL',
        'Expresso': 'EXPRESSO_SN',
    };
    const body = {
        account_alias: data.phoneNumber,
        amount: data.amount,
        network: operatorMap[data.operator] || 'ORANGE_MONEY_SENEGAL',
        notes: data.description
    };
    const res = await fetch(`${BASE_URL}/direct-pay/credit-account`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body)
    });
    return res.json();
}
// Vérifier le solde du compte marchand
export async function checkBalance() {
    const res = await fetch(`${BASE_URL}/direct-pay/get-balance`, {
        headers: HEADERS
    });
    return res.json();
}
