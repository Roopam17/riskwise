import { describe, expect, it } from 'vitest'
import { editDistance, searchIndex } from '../search'

const index = [
  { sym: 'ADANIENT', name: 'Adani Enterprises Limited', modelled: true },
  { sym: 'ADANIPORTS', name: 'Adani Ports and Special Economic Zone Limited', modelled: true },
  { sym: 'ADANIPOWER', name: 'Adani Power Limited', modelled: true },
  { sym: 'RELIANCE', name: 'Reliance Industries Limited', modelled: true },
  { sym: 'SBIN', name: 'State Bank of India', modelled: true },
  { sym: 'TCS', name: 'Tata Consultancy Services Limited', modelled: true },
  { sym: 'TINYCO', name: 'Tiny Company Limited', modelled: false },
]
const syms = (q, opts) => searchIndex(index, q, opts).map((e) => e.sym)

describe('search', () => {
  it('typing "adani" finds every Adani stock and nothing else', () => {
    const found = syms('adani')
    expect(found).toEqual(expect.arrayContaining(['ADANIENT', 'ADANIPORTS', 'ADANIPOWER']))
    expect(found).not.toContain('RELIANCE')
  })
  it('an exact symbol ranks first', () => expect(syms('tcs')[0]).toBe('TCS'))
  it('nicknames work', () => expect(syms('sbi')[0]).toBe('SBIN'))
  it('forgives a typo', () => expect(syms('relaince')[0]).toBe('RELIANCE'))
  it('matches a word inside the name', () => expect(syms('bank')).toContain('SBIN'))
  it('returns nothing for an empty query', () => expect(syms('   ')).toEqual([]))
  it('can leave out stocks already chosen', () => expect(syms('adani', { exclude: ['ADANIENT'] })).not.toContain('ADANIENT'))
  it('prefers stocks with a forecast on equal scores', () => {
    const tie = [{ sym: 'AAA2', name: 'Zed Co', modelled: false }, { sym: 'AAA1', name: 'Zed Co', modelled: true }]
    expect(searchIndex(tie, 'zed')[0].sym).toBe('AAA1')
  })
  it('counts letter edits', () => {
    expect(editDistance('abc', 'abc')).toBe(0)
    expect(editDistance('kitten', 'sitting')).toBe(3)
  })
})
