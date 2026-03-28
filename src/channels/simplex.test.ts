/**
 * Unit tests for SimpleX Channel
 *
 * @module channels/simplex.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { SimplexChannel } from './simplex.js';
import type { ChannelOpts, NewMessage } from '../types.js';

// Mock ws
vi.mock('ws', () => {
  const WebSocket = vi.fn();
  WebSocket.OPEN = 1;
  WebSocket.CONNECTING = 0;
  WebSocket.CLOSING = 2;
  WebSocket.CLOSED = 3;
  return { WebSocket };
});

// Mock logger
vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SimplexChannel', () => {
  let channel: SimplexChannel;
  let mockOnMessage: ReturnType<typeof vi.fn>;
  let mockOnChatMetadata: ReturnType<typeof vi.fn>;
  let mockWs: any;

  beforeEach(() => {
    mockOnMessage = vi.fn();
    mockOnChatMetadata = vi.fn();

    const opts: ChannelOpts = {
      onMessage: mockOnMessage,
      onChatMetadata: mockOnChatMetadata,
      registeredGroups: () => ({}),
    };

    channel = new SimplexChannel(opts);

    // Mock WebSocket instance
    mockWs = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
    };

    (WebSocket as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockWs);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('name', () => {
    it('should have name "simplex"', () => {
      expect(channel.name).toBe('simplex');
    });
  });

  describe('ownsJid', () => {
    it('should return true for simplex: prefixed JIDs', () => {
      expect(channel.ownsJid('simplex:alice')).toBe(true);
      expect(channel.ownsJid('simplex:bob_123')).toBe(true);
    });

    it('should return false for non-simplex JIDs', () => {
      expect(channel.ownsJid('telegram:123')).toBe(false);
      expect(channel.ownsJid('whatsapp:456')).toBe(false);
      expect(channel.ownsJid('alice')).toBe(false);
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(channel.isConnected()).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('should throw error when not connected', async () => {
      await expect(channel.sendMessage('simplex:alice', 'hello')).rejects.toThrow(
        'SimpleX WebSocket not connected'
      );
    });

    it('should throw error for invalid JID', async () => {
      // Set up connected state
      (WebSocket as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockWs);

      // Simulate connection
      let openHandler: Function | undefined;
      mockWs.on = vi.fn((event: string, handler: Function) => {
        if (event === 'open') openHandler = handler;
      });

      channel.connect().catch(() => {});
      await new Promise((resolve) => setImmediate(resolve));
      openHandler && openHandler();

      await expect(channel.sendMessage('invalid-jid', 'hello')).rejects.toThrow(
        'Invalid SimpleX JID'
      );
    });
  });

  describe('chunkMessage', () => {
    it('should return single chunk for short messages', () => {
      const text = 'Hello world';
      const chunks = (channel as any).chunkMessage(text, 100);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('should chunk long messages at newlines', () => {
      const line1 = 'a'.repeat(50);
      const line2 = 'b'.repeat(50);
      const text = `${line1}\n${line2}`;
      const chunks = (channel as any).chunkMessage(text, 60);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]).toBe(line1);
    });

    it('should chunk at spaces when no newlines available', () => {
      const words = Array(20).fill('word').join(' ');
      const chunks = (channel as any).chunkMessage(words, 20);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should hard break when no good break points', () => {
      const text = 'a'.repeat(100);
      const chunks = (channel as any).chunkMessage(text, 30);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBe(30);
    });
  });

  describe('handleEvent', () => {
    beforeEach(async () => {
      // Set up connected state
      let openHandler: Function | undefined;
      mockWs.on = vi.fn((event: string, handler: Function) => {
        if (event === 'open') openHandler = handler;
      });

      channel.connect().catch(() => {});
      await new Promise((resolve) => setImmediate(resolve));
      openHandler && openHandler();
    });

    it('should handle contactRequest events when autoAccept is enabled', () => {
      (channel as any).config.autoAccept = true;
      const sendSpy = vi.spyOn(mockWs, 'send');

      const event = {
        type: 'contactRequest',
        contactRequest: {
          contactRequestId: 1,
          localDisplayName: 'alice',
          profile: { displayName: 'Alice' },
        },
      };

      (channel as any).handleEvent(event);

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({ cmd: '/accept alice' })
      );
    });

    it('should not auto-accept when autoAccept is disabled', () => {
      (channel as any).config.autoAccept = false;
      const sendSpy = vi.spyOn(mockWs, 'send');

      const event = {
        type: 'contactRequest',
        contactRequest: {
          contactRequestId: 1,
          localDisplayName: 'alice',
        },
      };

      (channel as any).handleEvent(event);

      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('should handle newChatItem text messages', () => {
      const event = {
        type: 'newChatItem',
        contact: {
          contactId: 1,
          localDisplayName: 'bob',
        },
        msg: {
          msgId: 'msg-123',
          content: {
            type: 'text',
            text: 'Hello from SimpleX',
          },
        },
      };

      (channel as any).handleEvent(event);

      expect(mockOnMessage).toHaveBeenCalledWith(
        'simplex:bob',
        expect.objectContaining({
          chat_jid: 'simplex:bob',
          sender: '1',
          sender_name: 'bob',
          content: 'Hello from SimpleX',
          is_from_me: false,
        })
      );
    });

    it('should handle newChatItem file messages (log only)', () => {
      const event = {
        type: 'newChatItem',
        contact: {
          contactId: 1,
          localDisplayName: 'bob',
        },
        msg: {
          content: {
            type: 'file',
            file: { fileId: 'file-1', fileName: 'document.pdf', fileSize: 1024 },
          },
        },
      };

      (channel as any).handleEvent(event);

      // Should not trigger onMessage for files
      expect(mockOnMessage).not.toHaveBeenCalled();
    });

    it('should handle contactConnected events', () => {
      const event = {
        type: 'contactConnected',
        contact: {
          contactId: 1,
          localDisplayName: 'charlie',
        },
      };

      (channel as any).handleEvent(event);

      expect(mockOnChatMetadata).toHaveBeenCalledWith(
        'simplex:charlie',
        expect.any(String),
        'charlie',
        'simplex',
        false
      );
    });
  });

  describe('disconnect', () => {
    it('should close websocket and clear state', async () => {
      // Set up connected state
      let openHandler: Function | undefined;
      mockWs.on = vi.fn((event: string, handler: Function) => {
        if (event === 'open') openHandler = handler;
      });

      channel.connect().catch(() => {});
      await new Promise((resolve) => setImmediate(resolve));
      openHandler && openHandler();

      await channel.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
      expect(channel.isConnected()).toBe(false);
    });
  });
});
