/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { BeallsListTool, testExports } from './bealls-list.js';
import { ToolDisplayNames, ToolNames } from './tool-names.js';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockAxiosGet = vi.mocked(axios.get);

const publishersHtml = `
  <main>
    <h2>Original list</h2>
    <p>Archived list.</p>
    <ul>
      <li><a href="https://example.org/academic">Academic Journals</a></li>
      <li>Example Publisher Without Link</li>
    </ul>
    <h2>Update</h2>
    <p>New additions.</p>
    <ul>
      <li><a href="/relative-publisher">BioMedGrid, LLC</a></li>
    </ul>
  </main>
`;

const journalsHtml = `
  <main>
    <h2>Original list</h2>
    <ul>
      <li><a href="https://ajer.org">American Journal of Engineering Research</a></li>
    </ul>
    <h2>Update</h2>
    <ul>
      <li><a href="https://biomedres.us">Biomedical Journal of Scientific & Technical Research</a> (BJSTR)</li>
    </ul>
  </main>
`;

const hijackedHtml = `
  <main>
    <h2>Original list</h2>
    <ul>
      <li><a href="https://hijacked.example">Hijacked Example Journal</a></li>
    </ul>
  </main>
`;

describe('BeallsListTool', () => {
  let tool: BeallsListTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new BeallsListTool();
  });

  it('has expected metadata', () => {
    expect(tool.name).toBe(ToolNames.BEALLS_LIST);
    expect(tool.displayName).toBe(ToolDisplayNames.BEALLS_LIST);
    expect(tool.kind).toBe('fetch');
  });

  it('extracts original and update list entries from content sections', () => {
    const entries = testExports.extractEntriesFromHtml(
      publishersHtml,
      'https://beallslist.net/',
      'https://beallslist.net',
      'publisher',
    );

    expect(entries).toEqual([
      {
        name: 'Academic Journals',
        url: 'https://example.org/academic',
        category: 'publisher',
        list_type: 'original_list',
        source_page: 'https://beallslist.net/',
        source_domain: 'https://beallslist.net',
      },
      {
        name: 'Example Publisher Without Link',
        url: null,
        category: 'publisher',
        list_type: 'original_list',
        source_page: 'https://beallslist.net/',
        source_domain: 'https://beallslist.net',
      },
      {
        name: 'BioMedGrid, LLC',
        url: 'https://beallslist.net/relative-publisher',
        category: 'publisher',
        list_type: 'update_list',
        source_page: 'https://beallslist.net/',
        source_domain: 'https://beallslist.net',
      },
    ]);
  });

  it('matches full or partial journal names case-insensitively', () => {
    const match = testExports.matchEntry(
      {
        name: 'Biomedical Journal of Scientific & Technical Research (BJSTR)',
        url: 'https://biomedres.us',
        category: 'standalone_journal',
        list_type: 'update_list',
        source_page: 'https://beallslist.net/standalone-journals/',
        source_domain: 'https://beallslist.net',
      },
      'scientific technical',
    );

    expect(match?.match_type).toBe('partial');
    expect(match?.score).toBe(60);
  });

  it('fetches Bealls pages and returns matching results', async () => {
    mockAxiosGet.mockImplementation(async (url: string) => {
      if (url.endsWith('/standalone-journals/')) {
        return { data: journalsHtml };
      }
      if (url.endsWith('/hijacked-journals/')) {
        return { data: hijackedHtml };
      }
      return { data: publishersHtml };
    });

    const result = await tool
      .build({ query: 'engineering research', maxResults: 10 })
      .execute(new AbortController().signal);

    expect(result.returnDisplay).toBe("Found 1 Beall's List match(es).");
    expect(result.llmContent).toContain(
      'American Journal of Engineering Research',
    );
    expect(result.llmContent).toContain('standalone_journal');
  });

  it('returns no matches when the journal is absent', async () => {
    mockAxiosGet.mockResolvedValue({ data: publishersHtml });

    const result = await tool
      .build({ query: 'Journal That Does Not Exist' })
      .execute(new AbortController().signal);

    expect(result.returnDisplay).toBe("No Beall's List matches found.");
    expect(result.llmContent).toContain('"total_matches": 0');
  });
});
