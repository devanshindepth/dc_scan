import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

// Privacy control event schema
const privacyControlEventSchema = z.object({
    developerId: z.string(),
    action: z.enum(['pause', 'resume']),
    reason: z.string().optional(),
    timestamp: z.string()
});

export const config: EventConfig = {
    name: 'PrivacyControlHandler',
    type: 'event',
    subscribes: ['privacy-control-changed'],
    description: 'Handles privacy control changes and manages tracking state',
    emits: ['tracking-state-updated']
};

export const handler = async (event: any, { logger, emit, state }: any) => {
    try {
        const { developerId, action, reason, timestamp } = privacyControlEventSchema.parse(event);

        logger.info(`Processing privacy control change: ${action} for developer ${developerId}`, {
            developerId,
            action,
            reason,
            timestamp
        });

        // Store privacy control state
        const stateKey = `privacy_control:${developerId}`;
        const privacyState = {
            isPaused: action === 'pause',
            lastChanged: timestamp,
            reason: reason || null,
            history: await getPrivacyHistory(developerId, state) || []
        };

        // Add current action to history
        privacyState.history.push({
            action,
            timestamp,
            reason: reason || null
        });

        // Keep only last 10 privacy control changes
        if (privacyState.history.length > 10) {
            privacyState.history = privacyState.history.slice(-10);
        }

        // Update state
        await state.set(stateKey, privacyState);

        // Emit tracking state update event
        await emit('tracking-state-updated', {
            developerId,
            isPaused: privacyState.isPaused,
            timestamp,
            action,
            reason
        });

        logger.info(`Privacy control state updated for developer ${developerId}`, {
            isPaused: privacyState.isPaused,
            historyCount: privacyState.history.length
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            logger.warn('Invalid privacy control event data:', (error as any).errors);
            return;
        }

        logger.error('Error processing privacy control event:', error);
        throw error;
    }
};

// Helper function to get privacy history from state
async function getPrivacyHistory(developerId: string, state: any): Promise<Array<{
    action: string;
    timestamp: string;
    reason: string | null;
}>> {
    try {
        const stateKey = `privacy_control:${developerId}`;
        const existingState = await state.get(stateKey);
        return existingState?.history || [];
    } catch (error) {
        console.warn('Could not retrieve privacy history:', error);
        return [];
    }
}