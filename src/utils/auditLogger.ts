import { Request } from 'express';
import { supabase } from '../config/supabase.js';

interface AuditLogParams {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: object;
    req?: Request; // Optional: to capture IP/UserAgent
}

export const logAudit = async ({ userId, action, resource, resourceId, details, req }: AuditLogParams) => {
    try {
        let ipAddress = 'unknown';
        let userAgent = 'unknown';

        if (req) {
            ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
            userAgent = req.headers['user-agent'] || 'unknown';
        }

        const { error } = await supabase
            .from('audit_logs')
            .insert({
                userId,
                action,
                resource,
                resourceId,
                details,
                ipAddress,
                userAgent
            });

        if (error) {
            console.error('Failed to write audit log:', error.message);
        }
    } catch (err) {
        console.error('Audit logging exception:', err);
    }
};
