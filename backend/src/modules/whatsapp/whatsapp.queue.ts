import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export interface QueuedOutboundMessage {
  id: string;
  to: string;
  text: string;
  timestamp: number;
  retries?: number;
}

export type InboundMessageHandler = (msg: any) => Promise<void>;
export type OutboundMessageSender = (to: string, text: string) => Promise<boolean>;
export type IsConnectedChecker = () => boolean;

export class WhatsAppQueue {
  private inboundQueue: any[] = [];
  private outboundQueue: QueuedOutboundMessage[] = [];
  private processedMessageIds = new Set<string>();
  private isInboundProcessing = false;
  private isOutboundDraining = false;
  private queueFilePath: string;
  private processedIdsFilePath: string;

  private inboundHandler: InboundMessageHandler | null = null;
  private outboundSender: OutboundMessageSender | null = null;
  private isConnectedChecker: IsConnectedChecker | null = null;

  constructor() {
    const baseDir = process.env.VERCEL ? '/tmp' : process.cwd();
    const storageDir = path.resolve(baseDir, 'storage');
    try {
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
    } catch {}
    this.queueFilePath = path.join(storageDir, 'whatsapp_outbound_queue.json');
    this.processedIdsFilePath = path.join(storageDir, 'whatsapp_processed_ids.json');

    this.loadOutboundQueueFromDisk();
    this.loadProcessedIdsFromDisk();
  }

  public setInboundHandler(handler: InboundMessageHandler) {
    this.inboundHandler = handler;
  }

  public setOutboundSender(sender: OutboundMessageSender, isConnected?: IsConnectedChecker) {
    this.outboundSender = sender;
    if (isConnected) {
      this.isConnectedChecker = isConnected;
    }
  }

  public isConnected(): boolean {
    if (this.isConnectedChecker) {
      return this.isConnectedChecker();
    }
    return false;
  }

  // ─── INBOUND QUEUE (Sequential FIFO Ingestion) ────────────────────
  /**
   * Enqueues incoming WhatsApp messages and triggers sequential in-order processing.
   */
  public enqueueInbound(messages: any[], customHandler?: InboundMessageHandler) {
    if (!Array.isArray(messages) || messages.length === 0) return;

    if (customHandler) {
      this.inboundHandler = customHandler;
    }

    // Filter out already processed messages or messages without content
    const freshMessages = messages.filter((msg) => {
      const id = msg?.key?.id;
      if (!id || this.processedMessageIds.has(id)) return false;
      return Boolean(msg.message);
    });

    if (freshMessages.length === 0) return;

    // Sort chronologically by WhatsApp messageTimestamp (oldest first -> strictly in sequence)
    freshMessages.sort((a, b) => {
      const timeA = Number(a.messageTimestamp || 0);
      const timeB = Number(b.messageTimestamp || 0);
      return timeA - timeB;
    });

    freshMessages.forEach((m) => {
      this.inboundQueue.push(m);
    });

    console.log(
      `[WhatsApp Queue] 📥 Enqueued ${freshMessages.length} inbound message(s). Total in queue: ${this.inboundQueue.length}`
    );

    this.processInboundQueue();
  }

  private async processInboundQueue() {
    if (this.isInboundProcessing) return;
    this.isInboundProcessing = true;

    try {
      while (this.inboundQueue.length > 0) {
        const nextMsg = this.inboundQueue.shift();
        if (!nextMsg) continue;

        const id = nextMsg.key?.id;
        if (id && this.processedMessageIds.has(id)) {
          continue;
        }

        try {
          if (this.inboundHandler) {
            await this.inboundHandler(nextMsg);
          } else {
            console.warn('[WhatsApp Queue] No inbound message handler registered.');
          }
        } catch (err: any) {
          console.error(`[WhatsApp Queue] Error processing inbound message ${id}:`, err?.message);
        } finally {
          if (id) {
            this.markMessageProcessed(id);
          }
        }

        // Brief delay between messages to preserve natural conversational sequence
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } finally {
      this.isInboundProcessing = false;
    }
  }

  // ─── OUTBOUND QUEUE (Offline Buffering & Auto-Drain on Connect) ───
  /**
   * Enqueues an outbound message when WhatsApp or Chatbot server is offline/disconnected.
   */
  public enqueueOutbound(to: string, text: string) {
    const item: QueuedOutboundMessage = {
      id: crypto.randomUUID(),
      to,
      text,
      timestamp: Date.now(),
      retries: 0,
    };

    this.outboundQueue.push(item);
    this.saveOutboundQueueToDisk();

    console.log(
      `[WhatsApp Queue] ⏳ Chatbot/WhatsApp offline. Queued outbound message for ${to}. Pending in queue: ${this.outboundQueue.length}`
    );

    // If connected, attempt to drain immediately
    if (this.isConnected()) {
      this.drainOutboundQueue();
    }
  }

  /**
   * Drains outbound messages in exact FIFO sequence once connection is restored.
   */
  public async drainOutboundQueue() {
    if (this.isOutboundDraining || !this.isConnected() || this.outboundQueue.length === 0) {
      return;
    }

    if (!this.outboundSender) {
      console.warn('[WhatsApp Queue] No outbound sender registered.');
      return;
    }

    this.isOutboundDraining = true;
    console.log(
      `[WhatsApp Queue] 🚀 Connection active! Starting sequential transfer of ${this.outboundQueue.length} queued message(s)...`
    );

    try {
      while (this.outboundQueue.length > 0 && this.isConnected()) {
        const item = this.outboundQueue[0];
        if (!item) break;

        const elapsedSeconds = Math.round((Date.now() - item.timestamp) / 1000);
        console.log(
          `[WhatsApp Queue] 📤 Transferring queued message to ${item.to} (waited in queue: ${elapsedSeconds}s)...`
        );

        try {
          const success = await this.outboundSender(item.to, item.text);
          if (success) {
            this.outboundQueue.shift(); // Remove delivered message
            this.saveOutboundQueueToDisk();
          } else {
            item.retries = (item.retries || 0) + 1;
            if (item.retries >= 3) {
              console.warn(`[WhatsApp Queue] ⚠️ Max retries reached for queued message ${item.id}. Dropping.`);
              this.outboundQueue.shift();
              this.saveOutboundQueueToDisk();
            } else {
              break; // Wait for next retry cycle
            }
          }
        } catch (sendErr: any) {
          console.error(`[WhatsApp Queue] Failed to transfer queued message:`, sendErr?.message);
          break;
        }

        // Stagger deliveries by 500ms to preserve sequence and avoid WhatsApp spam flags
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (this.outboundQueue.length === 0) {
        console.log('[WhatsApp Queue] ✅ All queued messages successfully transferred in sequence!');
      } else {
        console.log(`[WhatsApp Queue] ⏸️ ${this.outboundQueue.length} messages remaining in queue.`);
      }
    } finally {
      this.isOutboundDraining = false;
    }
  }

  public getStats() {
    return {
      inboundPending: this.inboundQueue.length,
      outboundPending: this.outboundQueue.length,
      isDraining: this.isOutboundDraining,
      isProcessingInbound: this.isInboundProcessing,
    };
  }

  // ─── PERSISTENCE HELPERS ──────────────────────────────────────────
  private saveOutboundQueueToDisk() {
    try {
      fs.writeFileSync(this.queueFilePath, JSON.stringify(this.outboundQueue, null, 2), 'utf-8');
    } catch (e: any) {
      console.error('[WhatsApp Queue] Error saving outbound queue to disk:', e?.message);
    }
  }

  private loadOutboundQueueFromDisk() {
    try {
      if (fs.existsSync(this.queueFilePath)) {
        const content = fs.readFileSync(this.queueFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          this.outboundQueue = parsed;
          if (this.outboundQueue.length > 0) {
            console.log(
              `[WhatsApp Queue] 📂 Loaded ${this.outboundQueue.length} pending queued message(s) from disk storage.`
            );
          }
        }
      }
    } catch (e: any) {
      console.error('[WhatsApp Queue] Error reading outbound queue from disk:', e?.message);
      this.outboundQueue = [];
    }
  }

  private markMessageProcessed(id: string) {
    this.processedMessageIds.add(id);
    if (this.processedMessageIds.size > 2000) {
      const first = this.processedMessageIds.values().next().value;
      if (first) this.processedMessageIds.delete(first);
    }
    this.saveProcessedIdsToDisk();
  }

  private saveProcessedIdsToDisk() {
    try {
      const arr = Array.from(this.processedMessageIds).slice(-1000);
      fs.writeFileSync(this.processedIdsFilePath, JSON.stringify(arr), 'utf-8');
    } catch (e: any) {
      // Non-critical
    }
  }

  private loadProcessedIdsFromDisk() {
    try {
      if (fs.existsSync(this.processedIdsFilePath)) {
        const content = fs.readFileSync(this.processedIdsFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => this.processedMessageIds.add(id));
        }
      }
    } catch (e: any) {
      this.processedMessageIds = new Set();
    }
  }
}

export const whatsAppQueue = new WhatsAppQueue();
