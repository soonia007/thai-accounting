import { fitWithin } from './logo'

describe('fitWithin', () => {
  it('scales a wide logo down to the max width', () => {
    expect(fitWithin(1600, 400, 800, 400)).toEqual({ width: 800, height: 200 })
  })
  it('scales a tall logo down to the max height', () => {
    expect(fitWithin(500, 1000, 800, 400)).toEqual({ width: 200, height: 400 })
  })
  it('never scales a small logo up', () => {
    expect(fitWithin(120, 60, 800, 400)).toEqual({ width: 120, height: 60 })
  })
})
