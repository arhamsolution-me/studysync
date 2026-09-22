import { Request, Response } from 'express';
import { whatsAppService } from './whatsapp.service';
import { loadUserSettings } from '../../config/database';

export class WhatsAppController {
  async getStatus(_req: Request, res: Response) {
    try {
      const status = whatsAppService.getStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async connect(_req: Request, res: Response) {
    try {
      if (!whatsAppService.isConnected && !whatsAppService.isConnecting) {
        whatsAppService.init().catch(() => {});
      }
      res.json({
        success: true,
        message: 'WhatsApp connection initiated.',
        data: whatsAppService.getStatus(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async disconnect(_req: Request, res: Response) {
    try {
      await whatsAppService.disconnect();
      res.json({
        success: true,
        message: 'WhatsApp successfully disconnected.',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async sendTestMessage(req: Request, res: Response) {
    try {
      const settings = loadUserSettings();
      const targetPhone = req.body?.phoneNumber || whatsAppService.phoneNumber || settings.whatsappNumber;

      if (!targetPhone) {
        return res.status(400).json({
          success: false,
          message: 'No WhatsApp number linked. Please link WhatsApp first or specify phoneNumber in request body.',
        });
      }

      const testMsg =
        req.body?.message ||
        `🎓 *StudySync AI — WhatsApp Integration Test*\n\n` +
        `✅ Connection verified successfully!\n` +
        `Your WhatsApp is actively linked with StudySync.\n\n` +
        `💡 *Quick Start Commands:*\n` +
        `• Send *agent on* to activate\n` +
        `• Send *Course Database Systems* to chat with course bot\n` +
        `• Send *exit* to return to standby\n\n` +
        `_Happy studying! 📚_`;

      const sent = await whatsAppService.sendMessage(targetPhone, testMsg);

      if (!sent) {
        return res.status(500).json({
          success: false,
          message: 'Failed to send WhatsApp message. Please check if socket is connected.',
        });
      }

      res.json({
        success: true,
        message: `Test WhatsApp message dispatched to +${targetPhone}!`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export const whatsAppController = new WhatsAppController();
