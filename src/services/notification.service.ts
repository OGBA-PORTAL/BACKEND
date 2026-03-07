import { supabase } from '../config/supabase.js';

interface NotifyParams {
    userId: string;
    title: string;
    message: string;
    type?: 'INFO' | 'ALERT' | 'SUCCESS';
}

export const NotificationService = {
    // Dispatch a single notification to a specific user
    async notifyUser({ userId, title, message, type = 'INFO' }: NotifyParams) {
        try {
            await supabase.from('notifications').insert([{ userId, title, message, type }]);
        } catch (error) {
            console.error('Failed to send notification to user', userId, error);
        }
    },

    // Dispatch a single notification to an array of users
    async notifyUsers(userIds: string[], title: string, message: string, type: 'INFO' | 'ALERT' | 'SUCCESS' = 'INFO') {
        if (!userIds.length) return;
        const payload = userIds.map(userId => ({ userId, title, message, type }));
        try {
            await supabase.from('notifications').insert(payload);
        } catch (error) {
            console.error('Failed to dispatch bulk notifications', error);
        }
    },

    // Find all users of a specific role and notify them
    async notifyRole(role: string, title: string, message: string, type: 'INFO' | 'ALERT' | 'SUCCESS' = 'INFO') {
        try {
            const { data: users } = await supabase.from('users').select('id').eq('role', role);
            if (users && users.length > 0) {
                const userIds = users.map(u => u.id);
                await this.notifyUsers(userIds, title, message, type);
            }
        } catch (error) {
            console.error(`Failed to notify role ${role}`, error);
        }
    },

    // Find all church admins for a specific church and notify them
    async notifyChurchAdmins(churchId: string, title: string, message: string, type: 'INFO' | 'ALERT' | 'SUCCESS' = 'INFO') {
        try {
            const { data: users } = await supabase.from('users')
                .select('id')
                .eq('churchId', churchId)
                .in('role', ['CHURCH_ADMIN', 'ASSOCIATION_OFFICER']);

            if (users && users.length > 0) {
                const userIds = users.map(u => u.id);
                await this.notifyUsers(userIds, title, message, type);
            }
        } catch (error) {
            console.error(`Failed to notify admins of church ${churchId}`, error);
        }
    }
};
