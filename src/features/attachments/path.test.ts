import { attachmentPath } from './path'

describe('attachmentPath', () => {
  it('puts the file in the company folder with a unique prefix', () => {
    expect(attachmentPath('co-1', 'Receipt May.JPG', 'u1')).toBe('co-1/u1-Receipt-May.jpg')
  })
  it('strips characters Storage keys do not like (Thai names fall back to "file")', () => {
    expect(attachmentPath('co-1', 'ใบเสร็จ.pdf', 'u1')).toBe('co-1/u1-file.pdf')
    expect(attachmentPath('co-1', '../../etc/passwd', 'u1')).toBe('co-1/u1-passwd')
  })
})
