/**
 * NanoClaw SimpleX Chat Channel
 *
 * A privacy-first messaging channel that connects to the simplex-chat CLI
 * via WebSocket. Provides end-to-end encrypted messaging with no phone numbers
 * or user identifiers.
 *
 * @module channels/simplex
 */

import { WebSocket } from 'ws';
import {
  Channel,
  ChannelOpts,
  NewMessage,
  OnInboundMessage,
  OnChatMetadata,
} from '../types.js';
import { registerChannel } from './registry.js';
import { logger } from '../logger.js';

// Channel configuration from config.json
interface SimplexConfig {
  enabled?: boolean;
  wsUrl?: string;
  autoAccept?: boolean;
  displayName?: string;
}

// SimpleX CLI WebSocket event types
interface SimplexEvent {
  type?: string;
  contact?: SimplexContact;
  contactRequest?: SimplexContactRequest;
  msg?: SimplexMessage;
  [key: string]: unknown;
}

interface SimplexContact {
  contactId: number;
  localDisplayName: string;
  profile?: {
    displayName: string;
    fullName?: string;
  };
}

interface SimplexContactRequest {
  contactRequestId: number;
  localDisplayName: string;
  profile?: {
    displayName: string;
    fullName?: string;
  };
}

interface SimplexMessage {
  msgId?: string;
  chatMsgId?: number;
  sharedMsgId?: string;
  content?: {
    type: string;
    text?: string;
    file?: SimplexFile;
  };
  file?: SimplexFile;
}

interface SimplexFile {
  fileId: string;
  fileName: string;
  fileSize: number;
}

// JID prefix for SimpleX contacts
const JID_PREFIX = 'simplex:';

/**
 * SimpleX Chat Channel implementation for NanoClaw.
 *
 * Connects to the simplex-chat CLI via WebSocket and implements the Channel
 * interface for bidirectional messaging.
 */
class SimplexChannel implements Channel {
  readonly name = 'simplex';

  private ws: WebSocket | null = null;
  private connected = false;
  private config: SimplexConfig;
  private onMessage: OnInboundMessage;
  private onChatMetadata: OnChatMetadata;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly reconnectInterval = 5000; // 5 seconds

  constructor(opts: ChannelOpts) {
    this.onMessage = opts.onMessage;
    this.onChatMetadata = opts.onChatMetadata;
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from environment or defaults
   */
  private loadConfig(): SimplexConfig {
    return {
      enabled: process.env.SIMPLEX_ENABLED !== 'false',
      wsUrl: process.env.SIMPLEX_WS_URL || 'ws://127.0.0.1:5225',
      autoAccept: process.env.SIMPLEX_AUTO_ACCEPT !== 'false',
      displayName: process.env.SIMPLEX_DISPLAY_NAME || 'nanoclaw',
    };
  }

  /**
   * Update config from runtime configuration
   */
  updateConfig(config: SimplexConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Establish WebSocket connection to simplex-chat CLI
   */
  async connect(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('[simplex] Channel disabled, skipping connection');
      return;
    }

    if (this.connected && this.ws) {
      logger.debug('[simplex] Already connected');
      return;
    }

    const wsUrl = this.config.wsUrl || 'ws://127.0.0.1:5225';
    logger.info(`[simplex] Connecting to ${wsUrl}`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          logger.info('[simplex] Connected to SimpleX CLI');
          this.connected = true;
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const event = JSON.parse(data.toString()) as SimplexEvent;
            this.handleEvent(event);
          } catch (err) {
            logger.error('[simplex] Failed to parse message:', err);
          }
        });

        this.ws.on('error', (err) => {
          logger.error('[simplex] WebSocket error:', err.message);
          if (!this.connected) {
            reject(err);
          }
        });

        this.ws.on('close', () => {
          logger.warn('[simplex] WebSocket closed');
          this.connected = false;
          this.scheduleReconnect();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    logger.info(`[simplex] Reconnecting in ${this.reconnectInterval}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        logger.error('[simplex] Reconnection failed:', err.message);
      });
    }, this.reconnectInterval);
  }

  /**
   * Handle incoming WebSocket events from SimpleX CLI
   */
  private handleEvent(event: SimplexEvent): void {
    const eventType = event.type;

    switch (eventType) {
      case 'contactRequest':
        this.handleContactRequest(event);
        break;
      case 'newChatItem':
        this.handleNewMessage(event);
        break;
      case 'contactConnected':
        this.handleContactConnected(event);
        break;
      default:
        logger.debug(`[simplex] Unhandled event type: ${eventType}`);
    }
  }

  /**
   * Handle incoming contact requests
   */
  private handleContactRequest(event: SimplexEvent): void {
    if (!this.config.autoAccept) {
      logger.info('[simplex] Contact request received (auto-accept disabled)');
      return;
    }

    const request = event.contactRequest;
    if (!request) return;

    const name = request.localDisplayName || request.profile?.displayName;
    if (!name) return;

    logger.info(`[simplex] Auto-accepting contact request from: ${name}`);
    this.acceptContact(name);
  }

  /**
   * Handle new chat messages
   */
  private handleNewMessage(event: SimplexEvent): void {
    const contact = event.contact;
    const msg = event.msg;

    if (!contact || !msg?.content) return;

    const contactName = contact.localDisplayName || contact.profile?.displayName || 'unknown';
    const chatJid = `${JID_PREFIX}${contactName}`;

    // Handle text messages
    if (msg.content.type === 'text' && msg.content.text) {
      const message: NewMessage = {
        id: msg.msgId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        chat_jid: chatJid,
        sender: String(contact.contactId),
        sender_name: contactName,
        content: msg.content.text,
        timestamp: new Date().toISOString(),
        is_from_me: false,
        is_bot_message: false,
      };

      logger.info(`[simplex] Message from ${contactName}: ${msg.content.text.slice(0, 100)}`);
      this.onMessage(chatJid, message);
    }
    // Handle file attachments (log only for now)
    else if (msg.content.type === 'file') {
      logger.info(`[simplex] File received from ${contactName}: ${msg.content.file?.fileName}`);
    }
  }

  /**
   * Handle contact connected events
   */
  private handleContactConnected(event: SimplexEvent): void {
    const contact = event.contact;
    if (!contact) return;

    const contactName = contact.localDisplayName || contact.profile?.displayName || 'unknown';
    const chatJid = `${JID_PREFIX}${contactName}`;

    logger.info(`[simplex] Contact connected: ${contactName}`);

    // Report chat metadata for group discovery
    this.onChatMetadata(chatJid, new Date().toISOString(), contactName, 'simplex', false);
  }

  /**
   * Accept a contact request via CLI command
   */
  private acceptContact(name: string): void {
    if (!this.ws || !this.connected) return;

    const cmd = {
      cmd: `/accept ${name}`,
    };

    this.ws.send(JSON.stringify(cmd));
  }

  /**
   * Send a message to a SimpleX contact
   */
  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.ws || !this.connected) {
      throw new Error('SimpleX WebSocket not connected');
    }

    // Extract contact name from JID (simplex:<contact_name>)
    if (!jid.startsWith(JID_PREFIX)) {
      throw new Error(`Invalid SimpleX JID: ${jid}`);
    }

    const contactName = jid.slice(JID_PREFIX.length);

    // Chunk long messages (SimpleX has message size limits)
    const chunks = this.chunkMessage(text, 4000);

    for (const chunk of chunks) {
      const cmd = {
        cmd: `@${contactName} ${chunk}`,
      };

      this.ws.send(JSON.stringify(cmd));
      logger.debug(`[simplex] Sent message to ${contactName}`);

      // Small delay between chunks to avoid rate limiting
      if (chunks.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Chunk a long message into smaller pieces
   */
  private chunkMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }

      // Try to break at newline first, then space, then hard break
      let breakAt = remaining.lastIndexOf('\n', maxLen);
      if (breakAt < maxLen * 0.5) {
        breakAt = remaining.lastIndexOf(' ', maxLen);
      }
      if (breakAt < maxLen * 0.3) {
        breakAt = maxLen;
      }

      chunks.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }

    return chunks;
  }

  /**
   * Check if this channel owns the given JID
   */
  ownsJid(jid: string): boolean {
    return jid.startsWith(JID_PREFIX);
  }

  /**
   * Check if WebSocket connection is active
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect from SimpleX CLI
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    logger.info('[simplex] Disconnected');
  }
}

/**
 * Factory function to create SimpleX channel instance
 */
function createSimplexChannel(opts: ChannelOpts): Channel | null {
  // Check if SimpleX is enabled in config
  const enabled = process.env.SIMPLEX_ENABLED !== 'false';
  if (!enabled) {
    logger.info('[simplex] Channel disabled via SIMPLEX_ENABLED');
    return null;
  }

  return new SimplexChannel(opts);
}

// Register the channel
registerChannel('simplex', createSimplexChannel);

export { SimplexChannel, createSimplexChannel };
