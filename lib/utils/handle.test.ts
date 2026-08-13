import { describe, expect, it } from 'vitest'

import { handlePattern } from './handle'

describe('handlePattern', () => {
  it('deja intacto un seudónimo sin metacaracteres', () => {
    expect(handlePattern('MateConBizcochos')).toBe('MateConBizcochos')
    expect(handlePattern('ana2027')).toBe('ana2027')
  })

  it('escapa el guion bajo, que es comodín de LIKE y carácter válido de seudónimo', () => {
    expect(handlePattern('mate_con')).toBe('mate\\_con')
    expect(handlePattern('_ana_')).toBe('\\_ana\\_')
  })

  it('escapa también los metacaracteres que el formato no permite pero podrían llegar', () => {
    expect(handlePattern('100%')).toBe('100\\%')
    expect(handlePattern('a\\b')).toBe('a\\\\b')
  })
})
