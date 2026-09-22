import { Router } from 'express';
import { whatsAppController } from './whatsapp.controller';

const router = Router();

router.get('/status', (req, res) => whatsAppController.getStatus(req, res));
router.post('/connect', (req, res) => whatsAppController.connect(req, res));
router.post('/disconnect', (req, res) => whatsAppController.disconnect(req, res));
router.post('/send-test', (req, res) => whatsAppController.sendTestMessage(req, res));

export default router;
