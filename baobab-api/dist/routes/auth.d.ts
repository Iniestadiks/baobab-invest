declare const router: import("express-serve-static-core").Router;
declare function logAdminAction(adminId: string | null, action: string, targetUserId: string | null, reason: string, ip: string, ua: string): Promise<void>;
export { logAdminAction };
export default router;
//# sourceMappingURL=auth.d.ts.map