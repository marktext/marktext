import { describe, expect, it } from 'vitest'
import { pathBreadcrumb } from '@/components/titleBar/pathBreadcrumb'

// #5669 — the custom title bar showed only the filename on Windows because the
// breadcrumb split the native path (`C:\…`) on `/` (pathe's separator).
describe('title bar path breadcrumb (#5669)', () => {
  it('splits a native Windows path on the native separator', () => {
    expect(pathBreadcrumb('C:\\Users\\1\\Desktop\\112.md', '\\')).toEqual([
      'Users',
      '1',
      'Desktop'
    ])
  })

  it('splits a POSIX path on "/"', () => {
    expect(pathBreadcrumb('/Users/1/Desktop/112.md', '/')).toEqual([
      'Users',
      '1',
      'Desktop'
    ])
  })

  it('yields no breadcrumb for the pre-fix mixed case (native path, "/" separator)', () => {
    expect(pathBreadcrumb('C:\\Users\\1\\Desktop\\112.md', '/')).toEqual([])
  })

  it('keeps only the last three directories', () => {
    expect(pathBreadcrumb('/a/b/c/d/e.md', '/')).toEqual(['b', 'c', 'd'])
  })

  it('returns nothing for an empty path', () => {
    expect(pathBreadcrumb('', '/')).toEqual([])
  })
})
