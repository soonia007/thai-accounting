import { z } from 'zod'
import { isValidThaiTaxId, normalizeTaxId } from '@/lib/tax-id'

export const companySchema = z
  .object({
    name: z.string().trim().min(1, 'required'),
    taxId: z
      .string()
      .transform(normalizeTaxId)
      .refine((v) => v === '' || isValidThaiTaxId(v), 'taxId'),
    isHeadOffice: z.boolean(),
    branchCode: z.string().trim(),
    address: z.string().trim(),
    vatRegistered: z.boolean(),
  })
  .refine((v) => v.isHeadOffice || /^\d{5}$/.test(v.branchCode), {
    path: ['branchCode'],
    message: 'branchCode',
  })
  .refine((v) => !v.vatRegistered || v.taxId !== '', { path: ['taxId'], message: 'taxIdRequired' })

export type CompanyFormInput = z.input<typeof companySchema>
export type CompanyFormValues = z.output<typeof companySchema>
