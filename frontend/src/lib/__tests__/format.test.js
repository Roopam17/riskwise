import { describe, expect, it } from 'vitest'
import { explain, marketCap, meterPosition, rupees, sign, sliceRange, volume } from '../format'

describe('formatting', () => {
  it('shows rupees with Indian grouping', () => expect(rupees(1234567.8)).toBe('₹12,34,567.80'))
  it('says "Not available" instead of blank or NaN', () => {
    expect(rupees(null)).toBe('Not available')
    expect(marketCap(null)).toBe('Not available')
    expect(volume(null)).toBe('Not available')
  })
  it('writes market cap in crores and lakh crores', () => {
    expect(marketCap(1.96e12)).toBe('₹2.0 L Cr')
    expect(marketCap(5e10)).toBe('₹5,000 Cr')
  })
  it('puts a plus sign on gains', () => {
    expect(sign(2.94)).toBe('+2.9')
    expect(sign(-0.6)).toBe('-0.6')
  })
})

describe('risk meter', () => {
  const bands = { low_below: 2.3, high_from: 3.1 }
  it('puts Low in the first third, Medium in the middle, High at the end', () => {
    expect(meterPosition(1.0, bands)).toBeLessThan(33)
    const mid = meterPosition(2.7, bands)
    expect(mid).toBeGreaterThan(33)
    expect(mid).toBeLessThan(67)
    expect(meterPosition(5, bands)).toBeGreaterThan(67)
  })
  it('never leaves the bar', () => {
    expect(meterPosition(0, bands)).toBeGreaterThanOrEqual(0)
    expect(meterPosition(99, bands)).toBeLessThanOrEqual(100)
  })
  it('sits in the middle when we do not know the cut-offs', () => expect(meterPosition(2, null)).toBe(50))
})

describe('explanations and chart ranges', () => {
  const record = { name: 'Infosys Limited', forecast: { expected_move: 1.84, level: 'Low', vs_usual: 'About usual' } }
  it('explains a forecast without talking about direction or advice', () => {
    const text = explain(record)
    expect(text).toContain('1.8% a day')
    expect(text).toContain('Low risk')
    expect(text.toLowerCase()).not.toMatch(/buy|sell|will rise|will fall/)
  })
  it('keeps only the points inside the window', () => {
    const points = [['2026-01-01', 1], ['2026-09-01', 2], ['2026-10-01', 3]]
    expect(sliceRange(points, 60).map((p) => p[1])).toEqual([2, 3])
    expect(sliceRange([], 30)).toEqual([])
  })
})
