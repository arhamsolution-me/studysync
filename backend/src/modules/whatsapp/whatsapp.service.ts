import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { loadUserSettings, saveUserSettings } from '../../config/database';
import { whatsAppStateManager } from './whatsapp.state';
import { whatsAppHandler } from './whatsapp.handler';
import { whatsAppQueue } from './whatsapp.queue';

export class WhatsAppService {
  private sock: WASocket | null = null;
  private authDir: string;
  public isConnected = false;
  public isConnecting = false;
  public qrString: string | null = null;
  public qrCodeDataUrl: string | null = null;
  public phoneNumber: string | null = null;
  public userLid: string | null = null;
  public lastError: string | null = null;

  // Store of recent messages for decryption retries (fixes "Waiting for this message" in WhatsApp Web)
  private messageStore = new Map<string, any>();
  // Set of recently sent message IDs to prevent self-looping
  private sentMessageIds = new Set<string>();

  constructor() {
    this.authDir = path.resolve(process.cwd(), 'storage', 'whatsapp_auth');
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  public saveMessageToStore(id: string, message: any) {
    this.messageStore.set(id, message);
    if (this.messageStore.size > 3000) {
      const firstKey = this.messageStore.keys().next().value;
      if (firstKey) this.messageStore.delete(firstKey);
    }
  }

  /**
   * Initializes Baileys WhatsApp connection.
   * Auto-reconnects using saved credentials if available.
   */
  async init(): Promise<void> {
    if (this.sock && (this.isConnected || this.isConnecting)) {
      return;
    }

    this.isConnecting = true;
    this.lastError = null;

    try {
      console.log('[WhatsApp] 🔄 Initializing StudySync WhatsApp Agent Service...');
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      if (state.creds?.me) {
        if (state.creds.me.id) {
          this.phoneNumber = state.creds.me.id.split(':')[0].replace(/[^0-9]/g, '');
        }
        if ((state.creds.me as any)?.lid) {
          this.userLid = (state.creds.me as any).lid.split(':')[0].replace(/[^0-9]/g, '');
        }
      }

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }) as any,
        browser: ['StudySync AI', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        syncFullHistory: false,
        getMessage: async (key) => {
          if (key.id) {
            const cached = this.messageStore.get(key.id);
            if (cached) return cached;
          }
          return undefined;
        },
      });

      // Save credentials whenever updated
      this.sock.ev.on('creds.update', saveCreds);

      // Handle connection updates (QR code, open, close)
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrString = qr;
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
          } catch (qrErr) {
            console.error('[WhatsApp] Error converting QR to DataURL:', qrErr);
          }

          console.log('\n╔══════════════════════════════════════════════════════════════╗');
          console.log('║       📱 StudySync AI — Scan QR Code with WhatsApp          ║');
          console.log('║  (WhatsApp -> Settings -> Linked Devices -> Link a Device)   ║');
          console.log('╚══════════════════════════════════════════════════════════════╝\n');
          qrcodeTerminal.generate(qr, { small: true });
          console.log('\n[WhatsApp] Waiting for WhatsApp scan on your phone...\n');
        }

        if (connection === 'open') {
          this.isConnected = true;
          this.isConnecting = false;
          this.qrString = null;
          this.qrCodeDataUrl = null;

          const rawId = this.sock?.user?.id || '';
          const phone = rawId.split(':')[0].replace(/[^0-9]/g, '');
          this.phoneNumber = phone;

          const rawLid = (this.sock?.user as any)?.lid || '';
          if (rawLid) {
            this.userLid = rawLid.split(':')[0].replace(/[^0-9]/g, '');
          }

          // Save user phone number to user_settings.json
          const settings = loadUserSettings();
          saveUserSettings({ ...settings, whatsappNumber: phone });

          console.log(`[WhatsApp] ✅ StudySync WhatsApp Agent connected! Active Phone: +${phone}, LID: ${this.userLid || 'none'}`);

          // Drain queued outbound messages sequentially now that connection is established
          whatsAppQueue.drainOutboundQueue().catch((drainErr) => {
            console.error('[WhatsApp] Error draining outbound queue:', drainErr?.message);
          });
        }

        if (connection === 'close') {
          this.isConnected = false;
          this.isConnecting = false;

          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.warn(
            `[WhatsApp] ⚠️ Connection closed. Status: ${statusCode || 'unknown'}, Reconnect: ${shouldReconnect}`
          );

          if (statusCode === DisconnectReason.loggedOut) {
            console.log('[WhatsApp] 🚪 Logged out from WhatsApp. Resetting session credentials.');
            this.clearAuthStorage();
            this.sock = null;
          } else {
            // Auto-reconnect after brief backoff
            setTimeout(() => {
              this.init().catch((err) =>
                console.error('[WhatsApp] Reconnect error:', err.message)
              );
            }, 3000);
          }
        }
      });

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (!this.sock) return;

        const incomingToProcess: any[] = [];

        for (const msg of messages) {
          if (!msg.message) continue;

          // Save incoming message in store for retry handshakes
          if (msg.key?.id) {
            this.saveMessageToStore(msg.key.id, msg.message);
          }

          // Skip if it's our own bot-sent message
          const msgId = msg.key?.id;
          if (msgId && this.sentMessageIds.has(msgId)) {
            continue;
          }

          incomingToProcess.push(msg);
        }

        if (incomingToProcess.length > 0) {
          // Route through queue for strict sequential FIFO in-order execution
          whatsAppQueue.enqueueInbound(incomingToProcess);
        }
      });
    } catch (err: any) {
      this.isConnecting = false;
      this.isConnected = false;
      this.lastError = err.message;
      console.error('[WhatsApp] Initialization failed:', err.message);
    }
  }

  /**
   * Dispatches outbound message to a WhatsApp JID or phone number.
   * If server/WhatsApp is offline, it buffers into the persistent queue
   * and automatically sends in sequence when reconnected.
   */
  async sendMessage(to: string, text: string): Promise<boolean> {
    if (!this.sock || !this.isConnected) {
      console.warn(`[WhatsApp] Offline/Disconnected. Buffering message to ${to} into outbound queue.`);
      whatsAppQueue.enqueueOutbound(to, text);
      return true;
    }

    try {
      const sent = await this.rawSendMessage(to, text);
      if (!sent) {
        // If raw send failed (e.g. socket severed mid-transmission), queue it
        console.warn(`[WhatsApp] Raw send failed. Enqueueing to outbound queue for retry: ${to}`);
        whatsAppQueue.enqueueOutbound(to, text);
      }
      return sent;
    } catch (err: any) {
      console.error(`[WhatsApp] Error sending message to ${to}, queuing:`, err.message);
      whatsAppQueue.enqueueOutbound(to, text);
      return false;
    }
  }

  /**
   * Directly transmits message via active WhatsApp socket.
   */
  async rawSendMessage(to: string, text: string): Promise<boolean> {
    if (!this.sock || !this.isConnected) {
      return false;
    }

    try {
      // Normalize target JID
      let targetJid = to.trim();
      if (!targetJid.includes('@')) {
        const cleaned = targetJid.replace(/[^0-9]/g, '');
        targetJid = `${cleaned}@s.whatsapp.net`;
      } else {
        const [userPart, domainPart] = targetJid.split('@');
        targetJid = `${userPart.split(':')[0]}@${domainPart}`;
      }

      // If sending to user's self chat (LID or phone), prefer verified user phone JID
      if (this.phoneNumber && (targetJid.endsWith('@lid') || targetJid.includes(this.phoneNumber))) {
        targetJid = `${this.phoneNumber}@s.whatsapp.net`;
      }

      console.log(`[WhatsApp Outbound] Sending message to ${targetJid}...`);
      const sent = await this.sock.sendMessage(targetJid, { text });
      if (sent?.key?.id) {
        if (sent.message) {
          this.saveMessageToStore(sent.key.id, sent.message);
        }
        this.sentMessageIds.add(sent.key.id);
        // Keep cache bounded
        if (this.sentMessageIds.size > 2000) {
          const first = this.sentMessageIds.values().next().value;
          if (first) this.sentMessageIds.delete(first);
        }
      }
      return true;
    } catch (err: any) {
      console.error(`[WhatsApp] Failed to send raw message to ${to}:`, err.message);
      return false;
    }
  }

  /**
   * Returns current service status for REST endpoints and frontend
   */
  getStatus() {
    const settings = loadUserSettings();
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      phoneNumber: this.phoneNumber || settings.whatsappNumber || null,
      qrCode: this.qrCodeDataUrl,
      lastError: this.lastError,
      activeSessions: whatsAppStateManager.getAllSessions().length,
      queue: whatsAppQueue.getStats(),
    };
  }

  /**
   * Disconnects socket and clears stored credentials
   */
  async disconnect(): Promise<void> {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock.end(undefined);
        this.sock = null;
      }
    } catch {}

    this.isConnected = false;
    this.isConnecting = false;
    this.qrString = null;
    this.qrCodeDataUrl = null;
    this.phoneNumber = null;
    this.clearAuthStorage();
    console.log('[WhatsApp] 🔌 WhatsApp disconnected and auth cleared.');
  }

  private clearAuthStorage() {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
      }
    } catch (err: any) {
      console.error('[WhatsApp] Error clearing auth folder:', err.message);
    }
  }

  public isSentByBot(msgId?: string): boolean {
    if (!msgId) return false;
    return this.sentMessageIds.has(msgId);
  }

  /**
   * Downloads and decrypts media message buffer (audio voice notes, images, documents)
   */
  async downloadMedia(msg: any): Promise<Buffer | null> {
    try {
      if (!this.sock) return null;
      const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        {
          logger: pino({ level: 'silent' }) as any,
          reuploadRequest: this.sock.updateMediaMessage,
        }
      );
      return buffer as Buffer;
    } catch (err: any) {
      console.error('[WhatsApp] Failed to download media message:', err?.message);
      return null;
    }
  }

  public getMyPhoneNumber(): string {
    const rawId = this.sock?.user?.id || this.phoneNumber || '';
    return rawId.split(':')[0].replace(/[^0-9]/g, '');
  }

  public getMyLid(): string {
    if (this.userLid) return this.userLid;
    const rawLid = (this.sock?.user as any)?.lid || '';
    return rawLid.split(':')[0].replace(/[^0-9]/g, '');
  }

  public getRawSocket(): WASocket | null {
    return this.sock;
  }
}

export const whatsAppService = new WhatsAppService();

// Register queue handlers (eliminates circular import issues)
whatsAppQueue.setInboundHandler(async (msg) => {
  await whatsAppHandler.handleIncomingMessage(whatsAppService, msg);
});

whatsAppQueue.setOutboundSender(
  async (to, text) => whatsAppService.rawSendMessage(to, text),
  () => whatsAppService.isConnected
);
