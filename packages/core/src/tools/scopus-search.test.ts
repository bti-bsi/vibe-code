/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScopusSearchTool } from './scopus-search.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';

// Mock node:https and node:http get requests
const mockHttpsGet = vi.fn();
const mockHttpGet = vi.fn();

vi.mock('node:https', () => ({
  get: (...args: unknown[]) => mockHttpsGet(...args),
  default: {
    get: (...args: unknown[]) => mockHttpsGet(...args),
  },
}));

vi.mock('node:http', () => ({
  get: (...args: unknown[]) => mockHttpGet(...args),
  default: {
    get: (...args: unknown[]) => mockHttpGet(...args),
  },
}));

const mockScopusGet = vi.mocked(mockHttpsGet);
const mockDOIHttpGet = vi.mocked(mockHttpGet);

interface MockRes {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string | undefined>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => boolean;
}

interface MockReq {
  destroy: () => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => boolean;
}

describe('ScopusSearchTool', () => {
  let tool: ScopusSearchTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ScopusSearchTool();
  });

  function simulateResponse(statusCode: number, body: string): void {
    mockScopusGet.mockImplementation(
      (_url: string, _options: unknown, callback: (res: MockRes) => void) => {
        const mockRes: MockRes = {
          statusCode,
          statusMessage: statusCode === 200 ? 'OK' : 'Unauthorized',
          headers: { 'content-type': 'application/json' },
          on(_event: string, _cb: (...args: unknown[]) => void) {},
          emit(_event: string, ..._args: unknown[]) {
            return false;
          },
        };

        setImmediate(() => {
          callback(mockRes);
          setImmediate(() => {
            mockRes.emit('data', Buffer.from(body));
            setImmediate(() => {
              mockRes.emit('end');
            });
          });
        });

        const mockReq: MockReq = {
          destroy: () => {},
          on(_event: string, _cb: (...args: unknown[]) => void) {},
          emit(_event: string, ..._args: unknown[]) {
            return false;
          },
        };
        return mockReq;
      },
    );

    // Mock DOI URL fetch (robustHttpGet) - returns error for non-real DOIs
    mockDOIHttpGet.mockImplementation(
      (_url: string, _options: unknown, callback: (res: MockRes) => void) => {
        const mockRes: MockRes = {
          statusCode: 404,
          statusMessage: 'Not Found',
          headers: { 'content-type': 'text/html' },
          on(_event: string, _cb: (...args: unknown[]) => void) {},
          emit(_event: string, ..._args: unknown[]) {
            return false;
          },
        };

        setImmediate(() => {
          callback(mockRes);
          setImmediate(() => {
            mockRes.emit(
              'data',
              Buffer.from('<html><body>Not Found</body></html>'),
            );
            setImmediate(() => {
              mockRes.emit('end');
            });
          });
        });

        const mockReq: MockReq = {
          destroy: () => {},
          on(_event: string, _cb: (...args: unknown[]) => void) {},
          emit(_event: string, ..._args: unknown[]) {
            return false;
          },
        };
        return mockReq;
      },
    );
  }

  describe('tool metadata', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe(ToolNames.SCOPUS_SEARCH);
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe(ToolDisplayNames.SCOPUS_SEARCH);
    });

    it('should have Kind.Read', () => {
      expect(tool.kind).toBe('read');
    });
  });

  describe('tool execution', () => {
    it('should execute search and format results without abstracts by default', async () => {
      const mockBody = JSON.stringify({
        'search-results': {
          'opensearch:totalResults': '2',
          entry: [
            {
              'dc:title': 'Deep Learning in Healthcare',
              'dc:creator': {
                'text-item': [{ $: 'Smith, J.' }, { $: 'Doe, A.' }],
              },
              'prism:publicationName': 'Nature Medicine',
              'prism:coverDate': '2024-01-15',
              'prism:doi': '10.1234/test',
              'citedby-count': '42',
              'prism:abstract': 'This is a test abstract about deep learning.',
              'prism:url': 'https://www.scopus.com/record/test',
              link: [
                {
                  '@_ref': 'scopus-abs',
                  '@_href': 'https://www.scopus.com/inward/record.url?test',
                  '@_type': 'text/html',
                },
              ],
            },
          ],
        },
      });

      simulateResponse(200, mockBody);

      const invocation = tool.createInvocation({
        query: 'deep learning',
        apiKey: 'test-api-key',
        count: 10,
      });

      const result = await invocation.execute(new AbortController().signal);

      expect(result.returnDisplay).toContain('Found 1 results');
      expect(result.llmContent).toContain('Deep Learning in Healthcare');
      expect(result.llmContent).toContain('Smith, J.');
      expect(result.llmContent).toContain('Nature Medicine');
      expect(result.llmContent).toContain('Abstracts:** Not included');
    });

    it('should handle API errors', async () => {
      const mockBody = JSON.stringify({
        'service-error': {
          status: [
            {
              statusText: 'Unauthorized',
              message: 'Invalid API key',
            },
          ],
        },
      });

      simulateResponse(401, mockBody);

      const invocation = tool.createInvocation({
        query: 'test',
        apiKey: 'invalid-key',
      });

      const result = await invocation.execute(new AbortController().signal);

      expect(result.returnDisplay).toContain('Scopus search failed');
      expect(result.error).toBeDefined();
    });

    it('should handle empty results', async () => {
      const mockBody = JSON.stringify({
        'search-results': {
          'opensearch:totalResults': '0',
          entry: [],
        },
      });

      simulateResponse(200, mockBody);

      const invocation = tool.createInvocation({
        query: 'nonexistent topic xyz',
        apiKey: 'test-api-key',
      });

      const result = await invocation.execute(new AbortController().signal);

      expect(result.returnDisplay).toContain('No results found');
    });
  });
});
