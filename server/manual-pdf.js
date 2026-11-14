import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const secret = randomBytes(32)
const maxBytes = 50 * 1024 * 1024
const sign = (value) => createHmac('sha256', secret).update(value).digest()
export function manualToken(url) {
  const value = Buffer.from(url).toString('base64url')
  return value + '.' + sign(value).toString('base64url')
}

export function registerManualRoute(app) {
  app.get('/api/catalog/manual-pdf', async (request, response) => {
    const token = request.query.token
    if (typeof token !== 'string' || !/^[\w-]{1,4000}\.[\w-]{43}$/.test(token)) return response.sendStatus(400)
    const [value, signature] = token.split('.')
    if (!timingSafeEqual(sign(value), Buffer.from(signature, 'base64url'))) return response.sendStatus(403)
    try {
      const url = new URL(Buffer.from(value, 'base64url').toString('utf8'))
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return response.sendStatus(400)
      const pdf = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000) })
      if (!pdf.ok || !pdf.body || Number(pdf.headers.get('content-length')) > maxBytes) {
        await pdf.body?.cancel()
        throw new Error('Documento indisponível')
      }
      const chunks = []
      let size = 0
      for await (const chunk of pdf.body) {
        size += chunk.length
        if (size > maxBytes) throw new Error('Documento excede o limite')
        chunks.push(chunk)
      }
      const file = Buffer.concat(chunks, size)
      if (file.subarray(0, 5).toString() !== '%PDF-') throw new Error('Documento não é PDF')
      const disposition = request.query.download === '1' ? 'attachment' : 'inline'
      response.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition + '; filename="manual-do-proprietario.pdf"',
        'X-Content-Type-Options': 'nosniff',
      }).send(file)
    } catch {
      response.status(502).send('O manual está temporariamente indisponível. Tente novamente em instantes.')
    }
  })
}
