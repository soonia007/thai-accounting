import { expect, test } from '@playwright/test'

/**
 * Spec M9: sign up → create company → issue a tax invoice → receive payment → trial balance is
 * correct. Needs the local stack running (npm run db:start). Each run uses a fresh user + company.
 */
test('sign up → company → invoice → payment → trial balance', async ({ page }) => {
  const email = `e2e+${Date.now()}@example.com`
  const password = 'e2e-pass-123'
  page.on('dialog', (d) => void d.accept()) // posting asks for confirmation

  // 1. sign up (language: Thai, the default)
  await page.goto('/login?mode=signUp')
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.locator('button[type=submit]').click()

  // 2. onboarding: service business, VAT registered
  await expect(page.getByRole('radio', { name: /ธุรกิจบริการ/ })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('radio', { name: /ธุรกิจบริการ/ }).click()
  await page.getByRole('button', { name: 'ถัดไป' }).click()
  await page.locator('#name').fill('E2E Studio Co., Ltd.')
  if (!(await page.locator('#vatRegistered').isChecked()))
    await page.locator('#vatRegistered').click()
  await page.locator('#taxId').fill('1101700230708')
  await page.getByRole('button', { name: 'สร้างบริษัท' }).click()
  await expect(page.getByText('สวัสดี')).toBeVisible({ timeout: 20_000 })

  // 3. a customer
  await page.goto('/contacts')
  await page.getByRole('button', { name: /เพิ่มผู้ติดต่อ/ }).click()
  await page.locator('#c-name').fill('E2E Customer')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await expect(page.getByText('E2E Customer')).toBeVisible()

  // 4. invoice: 1,000 + 7% VAT, posted
  await page.goto('/sales/new/invoice')
  await page.locator('#d-contact').selectOption({ label: 'E2E Customer' })
  await page.getByPlaceholder('คำอธิบาย').first().fill('Consulting')
  await page.getByPlaceholder('0.00').first().fill('1000')
  await expect(page.getByText('1,070.00').first()).toBeVisible() // live simulation total
  await page.getByRole('button', { name: 'บันทึกและลงบัญชี' }).first().click()
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  await expect(page.getByText('INV-')).toBeVisible()

  // 5. receive the payment in full
  await page
    .getByRole('button', { name: /รับชำระ/ })
    .first()
    .click()
  await expect(page).toHaveURL(/payments\/new/)
  await page.getByRole('button', { name: 'บันทึกและลงบัญชี' }).last().click()
  await expect(page).toHaveURL(/\/sales\/payments\/[0-9a-f-]{36}$/, { timeout: 20_000 })

  // 6. trial balance: balanced; bank 1,070 debit; revenue 1,000 credit; VAT 70 credit
  await page.goto('/reports/trial-balance')
  await expect(page.getByText('งบสมดุล')).toBeVisible({ timeout: 20_000 })
  const row = (code: string) => page.locator('tr', { hasText: code })
  await expect(row('1120')).toContainText('1,070.00')
  await expect(row('4100')).toContainText('1,000.00')
  await expect(row('2120')).toContainText('70.00')
})
