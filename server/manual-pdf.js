import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const secret = randomBytes(32)
const maxBytes = 384 * 1024 * 1024
const sign = (value) => createHmac('sha256', secret).update(value).digest()
export function manualToken(url) {
  const value = Buffer.from(url).toString('base64url')
  return value + '.' + sign(value).toString('base64url')
}

export function withManualToken(manual) {
  return { ...manual, token: manualToken(manual.external_url) }
}

async function servePdf(pdf, request, response) {
  const contentLength = Number(pdf.headers.get('content-length'))
  if (!pdf.ok || !pdf.body || contentLength > maxBytes) {
    await pdf.body?.cancel()
    throw new Error('Documento indisponível')
  }

  const chunks = pdf.body[Symbol.asyncIterator]()
  try {
    const first = []
    let size = 0
    while (size < 5) {
      const { value, done } = await chunks.next()
      if (done) throw new Error('Documento incompleto')
      first.push(value)
      size += value.length
    }
    if (Buffer.concat(first, size).subarray(0, 5).toString() !== '%PDF-') throw new Error('Documento não é PDF')

    const disposition = request.query.download === '1' ? 'attachment' : 'inline'
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition + '; filename="manual-do-proprietario.pdf"',
      'X-Content-Type-Options': 'nosniff',
    })
    if (contentLength && !pdf.headers.has('content-encoding')) response.set('Content-Length', String(contentLength))

    async function* pdfChunks() {
      yield* first
      for await (const chunk of chunks) {
        size += chunk.length
        if (size > maxBytes) throw new Error('Documento excede o limite')
        yield chunk
      }
    }

    await pipeline(Readable.from(pdfChunks()), response)
  } finally {
    await chunks.return?.()
  }
}

export function registerManualRoute(app) {
  app.get('/api/catalog/manual-pdf', async (request, response) => {
    const token = request.query.token
    if (typeof token !== 'string' || !/^[\w-]{1,4000}\.[\w-]{43}$/.test(token)) return response.sendStatus(400)
    const [value, signature] = token.split('.')
    if (!timingSafeEqual(sign(value), Buffer.from(signature, 'base64url'))) return response.sendStatus(403)
    const client = new AbortController()
    response.once('close', () => client.abort())
    try {
      const url = new URL(Buffer.from(value, 'base64url').toString('utf8'))
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return response.sendStatus(400)
      const signal = AbortSignal.any([client.signal, AbortSignal.timeout(150000)])
      const pdf = await fetch(url, { redirect: 'error', signal })
      await servePdf(pdf, request, response)
    } catch {
      if (!response.headersSent && !response.destroyed) {
        response.status(502).send('O manual está temporariamente indisponível. Tente novamente em instantes.')
      }
    }
  })
}
