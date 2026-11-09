import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'

export default async function startServer(config) {
  const url = new URL(config.projects[0].use.baseURL)
  const health = new URL('/api/health', url)
  const existingServer = await fetch(health, { signal: AbortSignal.timeout(500) }).catch(() => null)
  if (existingServer) throw new Error('A porta do servidor de testes já está ocupada.')
  const directory = await mkdtemp(join(tmpdir(), 'painel-e2e-'))
  const server = spawn(process.execPath, ['server/index.js', '--production'], {
    env: { ...process.env, PORT: url.port, HOST: url.hostname, LEMBRACAR_DATA_DIR: directory },
    stdio: ['ignore', 'ignore', 'inherit'],
    windowsHide: true,
  })
  const closed = new Promise((resolve) => server.once('close', resolve))

  async function cleanup() {
    server.kill()
    await closed
    await rm(directory, { recursive: true, force: true })
  }

  try {
    await once(server, 'spawn')
    for (let attempt = 0; attempt < 50 && server.exitCode === null; attempt++) {
      const response = await fetch(health, { signal: AbortSignal.timeout(500) }).catch(() => null)
      if (response?.ok && server.exitCode === null) return cleanup
      await setTimeout(100)
    }
    throw new Error('Servidor isolado de testes não iniciou.')
  } catch (error) {
    await cleanup()
    throw error
  }
}
