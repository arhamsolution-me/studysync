import { Router } from 'express';
import { apiKeyController } from './apiKey.controller';
import { authGuard, auditLog } from '../../middleware';

const router = Router();

// Test key without saving
router.post('/test', authGuard, apiKeyController.testKey.bind(apiKeyController));

// Save key (encrypt and persist)
router.post('/', authGuard, auditLog('user_save_api_key'), apiKeyController.saveKey.bind(apiKeyController));

// List stored keys (masked only)
router.get('/', authGuard, apiKeyController.listKeys.bind(apiKeyController));

// Update preference (system vs byok)
router.patch('/preference', authGuard, auditLog('user_update_key_preference'), apiKeyController.setPreference.bind(apiKeyController));

// Delete key
router.delete('/:provider', authGuard, auditLog('user_delete_api_key'), apiKeyController.deleteKey.bind(apiKeyController));

export default router;
