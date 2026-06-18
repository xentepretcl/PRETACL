import { chromium } from 'playwright'

const browser = await chromium.launch()
const errors = []

async function shot(page, name) {
  await page.screenshot({ path: `verify-${name}.png` })
  console.log(`shot: ${name}`)
}

// --- Desktop pass ---
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[desktop] ${msg.text()}`) })
page.on('pageerror', (err) => errors.push(`[desktop pageerror] ${err.message}`))

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForSelector('text=PRET-')
await shot(page, '01-globe-desktop')

// open full lookbook
await page.click('text=VER TODO EL LOOKBOOK')
await page.waitForTimeout(600)
await shot(page, '02-lookbook-desktop')

// close lookbook back to globe
await page.click('button[aria-label="Cerrar"]')
await page.waitForTimeout(400)

// toggle a category filter, open category lookbook by clicking a button
await page.click('text=SUPERIOR')
await page.waitForTimeout(500)
await shot(page, '03-globe-filtered-desktop')

await page.click('text=VER SELECCIÓN')
await page.waitForTimeout(600)
await shot(page, '04-catlookbook-desktop')

await page.close()

// --- Mobile pass ---
const ctxM = await browser.newContext({ viewport: { width: 375, height: 812 } })
const pageM = await ctxM.newPage()
pageM.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[mobile] ${msg.text()}`) })
pageM.on('pageerror', (err) => errors.push(`[mobile pageerror] ${err.message}`))

await pageM.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await pageM.waitForSelector('text=PRET-')
await shot(pageM, '05-globe-mobile')

await pageM.close()
await browser.close()

console.log('ERRORS:', errors.length ? JSON.stringify(errors, null, 2) : 'none')
