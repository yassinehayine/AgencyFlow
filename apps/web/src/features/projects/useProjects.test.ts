import { describe, expect, it } from 'vitest';

import { toSearchParams } from './useProjects';

/**
 * Query-string building, tested because its failure mode is invisible in
 * development and obvious in production: an empty filter sent as `?status=`
 * fails `@IsIn` on the server, so "no filter selected" becomes a 400 that the
 * client produced itself.
 */
describe('toSearchParams', () => {
  it('keeps set values', () => {
    expect(toSearchParams({ page: 1, status: 'PLANNED' })).toBe('page=1&status=PLANNED');
  });

  it('drops undefined, null and empty strings', () => {
    expect(toSearchParams({ page: 2, status: undefined, search: '', clientId: null })).toBe(
      'page=2',
    );
  });

  /** `0` and `false` are legitimate values, not absences. */
  it('keeps falsy values that are not empty', () => {
    expect(toSearchParams({ page: 0, includeArchived: false })).toBe(
      'page=0&includeArchived=false',
    );
  });

  it('percent-encodes a search term rather than breaking the query string', () => {
    expect(toSearchParams({ search: 'refonte & site' })).toBe('search=refonte+%26+site');
  });

  it('returns an empty string when nothing is set', () => {
    expect(toSearchParams({ search: undefined })).toBe('');
  });
});
