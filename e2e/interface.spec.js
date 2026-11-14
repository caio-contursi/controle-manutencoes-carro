import { expect, test } from '@playwright/test'

const vehicle = { brand: 'Fiat', model: 'Palio', year: '2015', plate: 'ABC1D23' }
const pending = { title: 'Revisão pendente', status: 'Atrasada', km: 9000 }

async function seed(request, overrides = {}) {
  const data = { profile: { name: 'Teste' }, vehicle, mileage: 10000, expenses: [], maintenance: [], reminders: [], ...overrides }
  for (const [key, value] of Object.entries(data)) {
    const response = await request.put('/api/state/' + key, { data: { value } })
    expect(response.ok()).toBeTruthy()
  }
}

const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const dialog = (page) => page.getByRole('dialog')
async function nav(page, name) {
  const toggle = button(page, 'Abrir menu')
  if (await toggle.isVisible()) await toggle.click()
  await button(page.getByRole('navigation').filter({ visible: true }), name).click()
}

const pageErrors = new WeakMap()
test.beforeEach(({ page }) => {
  const errors = []
  pageErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]))

async function mockFipe(page) {
  const familyRequests = []
  const brandModels = {
    21: [
      { code: '10', name: 'Palio Fire 1.0 Flex 8V Hatch 3 portas' },
      { code: '11', name: 'Palio 1.6 16V Sedan 5P' },
      { code: '12', name: 'Uno 1.0 Flex' },
    ],
    59: [{ code: '20', name: 'Fox 1.0 Flex' }],
  }
  const familyYears = {
    '21/palio': [{ code: '2015', name: '2015' }, { code: '2013', name: '2013' }],
    '21/uno': [{ code: '2012', name: '2012' }],
    '59/fox': [{ code: '2018', name: '2018' }],
  }
  const familyVersions = {
    '21/palio/2015': [
      { code: '10', name: 'Palio Fire 1.0 Flex 8V Hatch 3p', yearCode: '2015-5', fuel: 'Flex' },
      { code: '11', name: 'Palio 1.6 16V Sedan 5p', yearCode: '2015-1', fuel: 'Gasolina' },
    ],
    '21/palio/2013': [{ code: '10', name: 'Palio Fire 1.0 Flex 8V Hatch 3p', yearCode: '2013-5', fuel: 'Flex' }],
  }
  await page.route('**/api/fipe/cars?**', async (route) => {
    const query = new URL(route.request().url()).searchParams
    const brand = query.get('brand')
    const family = query.get('family')
    const year = query.get('year')
    if (family) {
      const key = brand + '/' + family
      familyRequests.push(year ? key + '/' + year : key)
      return route.fulfill({ json: (year ? familyVersions[key + '/' + year] : familyYears[key]) ?? [] })
    }
    if (year) {
      return route.fulfill({ json: { brand: 'Fiat', model: 'Palio Fire', modelYear: 2015, fuel: 'Flex', price: 'R$ 25.000,00', referenceMonth: 'novembro de 2026', codeFipe: '001269-6', manuals: [{ external_url: 'https://servicos.fiat.com.br/manual.pdf', edition: '2015', token: 'pdf-test' }] } })
    }
    return route.fulfill({ json: brand ? brandModels[brand] : [{ code: '21', name: 'Fiat' }, { code: '59', name: 'Volkswagen' }] })
  })
  return familyRequests
}
async function selectFipe(page, familyRequests, open = true) {
  if (open) await button(page, 'Consultar Tabela FIPE').click()
  await page.getByRole('combobox', { name: 'Marca FIPE', exact: true }).selectOption('21')
  const select = (name) => page.getByRole('combobox', { name, exact: true })
  await expect(select('Ano-modelo')).toBeDisabled()
  await select('Carro').selectOption('palio')
  await expect(select('Ano-modelo').locator('option:not([value=""])')).toHaveText(['2015', '2013'])
  await expect(select('Modelo')).toHaveCount(0)
  expect(familyRequests).toEqual(['21/palio'])
  await select('Ano-modelo').selectOption('2015')
  await expect(select('Modelo').locator('option')).toHaveText([
    'Selecione', 'Palio Fire 1.0 Flex 8V Hatch 3p · Flex', 'Palio 1.6 16V Sedan 5p · Gasolina',
  ])
  expect(familyRequests).toEqual(['21/palio', '21/palio/2015'])
  await select('Modelo').selectOption('10/2015-5')
  await expect(page.getByText('R$ 25.000,00', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Manutenção', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Visualizar manual' })).toHaveAttribute('href', '/api/catalog/manual-pdf?token=pdf-test')
  await expect(page.getByRole('link', { name: 'Baixar PDF' })).toHaveAttribute('href', '/api/catalog/manual-pdf?token=pdf-test&download=1')
}

test('cadastro: consulta FIPE, volta, confirma e preserva o perfil ao recarregar', async ({ page, request }) => {
  await seed(request, { profile: null, vehicle: null })
  const familyRequests = await mockFipe(page)
  await page.goto('/')
  await expect(button(page, 'Continuar')).toBeDisabled()
  await selectFipe(page, familyRequests)
  await button(page, 'Usar no cadastro').click()
  await expect(page.getByLabel('Modelo', { exact: true })).toHaveValue('Palio Fire')
  await button(page, 'Continuar').click()
  await button(page, 'Editar dados').click()
  await expect(page.getByLabel('Ano', { exact: true })).toHaveValue('2015')
  await button(page, 'Continuar').click()
  await button(page, 'Confirmar veículo').click()
  await page.getByLabel('Cidade').fill('São Paulo')
  await page.getByLabel('Seu nome').fill('Pessoa de teste')
  await button(page, 'Continuar').click()
  await button(page, 'Começar').click()
  await expect(page.getByText('Olá, Pessoa de teste', { exact: true })).toBeVisible()
  await expect.poll(async () => (await (await request.get('/api/state')).json()).vehicle?.model).toBe('Palio Fire')
  await page.reload()
  await expect(page.getByText('Olá, Pessoa de teste', { exact: true })).toBeVisible()
})

test('desktop: perfil, veículo, odômetro, manutenções, gastos, lembretes, histórico e copiloto', async ({ page, request }) => {
  await seed(request, { maintenance: [pending] })
  await page.goto('/')
  await button(page, 'Atualizar quilometragem').click()
  await page.getByLabel('Quilometragem atual').fill('11000')
  await button(page, 'Cancelar edição').click()
  await expect(page.getByText('10.000 km', { exact: true })).toBeVisible()
  await button(page, 'Atualizar quilometragem').click()
  await page.getByLabel('Quilometragem atual').fill('12000')
  await button(page, 'Salvar quilometragem').click()

  await button(page, 'Abrir perfil').click()
  await dialog(page).getByLabel('Seu nome').fill('Perfil editado')
  await button(dialog(page), 'Salvar perfil').click()
  await expect(page.getByText('Olá, Perfil editado', { exact: true })).toBeVisible()
  await button(page, 'Editar veículo').click()
  await dialog(page).getByLabel('Modelo', { exact: true }).fill('Palio Fire')
  await button(dialog(page), 'Salvar veículo').click()

  await nav(page, 'Manutenções')
  await button(page, 'Atrasadas 1').click()
  await page.getByRole('button', { name: /Revisão pendente/ }).click()
  await dialog(page).getByLabel('Valor gasto').fill('180')
  await button(dialog(page), 'Marcar como concluído').click()
  await button(page, 'Em dia 1').click()
  await expect(page.getByText('Revisão pendente', { exact: true })).toBeVisible()
  await button(page, 'Revisões').click()
  await expect(page.getByText('Concluída', { exact: true })).toBeVisible()
  await button(page, 'Adicionar').click()
  await button(page, 'Registrar manutenção feita').click()
  await dialog(page).getByLabel('O que foi feito?').fill('Troca de óleo')
  await dialog(page).getByLabel('Tenho nota fiscal').check()
  await button(dialog(page), 'Registrar manutenção').click()
  await expect(button(page, 'Adicionar')).toBeVisible()
  await button(page, 'Criar lembrete').click()
  await dialog(page).getByLabel('O que lembrar?').fill('Conferir pneus')
  await dialog(page).getByLabel('Quando?').fill('2027-02-02')
  await button(dialog(page), 'Criar lembrete').click()
  await button(page, 'Lembretes (1)').click()
  await expect(dialog(page).getByText('Conferir pneus')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)

  await nav(page, 'Gastos')
  await button(page, 'Adicionar').click()
  await button(page, 'Registrar gasto').click()
  await dialog(page).getByLabel('Descrição').fill('Gasolina de teste')
  await dialog(page).getByLabel('Valor', { exact: true }).fill('200')
  await dialog(page).getByLabel('Litros').fill('32')
  await dialog(page).getByLabel('Quilometragem').fill('11500')
  await button(dialog(page), 'Salvar gasto').click()
  await expect(page.getByText('Gasolina de teste', { exact: true })).toBeVisible()
  await button(page, 'Gráficos').click()
  await expect(page.getByText('Seus gastos por categoria')).toBeVisible()
  await button(page, 'Extrato').click()
  await button(page, 'Remover Gasolina de teste').click()
  await expect(page.getByText('Gasolina de teste', { exact: true })).toHaveCount(0)
  await nav(page, 'Histórico')
  const timeline = page.locator('.timeline-card')
  await expect(timeline.getByText('Conferir pneus')).toBeVisible()
  await expect(timeline.getByText('Revisão pendente')).toHaveCount(1)
  await expect(timeline.getByText('Troca de óleo')).toBeVisible()
  await nav(page, 'Copiloto')
  await expect(page.locator('.copilot-avatar')).toHaveCount(0)
  await expect(button(page, 'Enviar mensagem')).toBeDisabled()
  const suggestionTitle = await page.getByRole('heading', { name: 'Sugestões para começar' }).boundingBox()
  const firstSuggestion = await button(page, 'O que está vencido?').boundingBox()
  expect(suggestionTitle.y + suggestionTitle.height).toBeLessThanOrEqual(firstSuggestion.y)
  await button(page, 'Quanto gastei este mês?').click()
  await expect(page.locator('.chat-bubble.assistant').first()).toContainText('180,00')
  await page.getByLabel('Mensagem para o Copiloto').fill('Qual a quilometragem do carro?')
  await button(page, 'Enviar mensagem').click()
  await expect(page.locator('.chat-bubble.assistant').last()).toContainText('12.000 km')
  await expect(page.getByRole('log', { name: 'Conversa atual' }).locator('.chat-bubble')).toHaveCount(4)
  await page.getByLabel('Mensagem para o Copiloto').fill('Quando troquei o oleo?')
  await button(page, 'Enviar mensagem').click()
  await expect(page.locator('.chat-bubble.assistant').last()).toContainText(/em \d{2}\/\d{2}\/\d{4} · Troca de óleo/)
  await nav(page, 'Início')
  await expect(page.getByText('12.000 km', { exact: true })).toBeVisible()
})

test('catálogo: consulta unificada FIPE e manual', async ({ page, request }) => {
  await seed(request)
  const familyRequests = await mockFipe(page)
  const stateRequests = []
  page.on('request', (entry) => {
    if (new URL(entry.url()).pathname.startsWith('/api/state')) stateRequests.push(entry.method())
  })
  await page.goto('/')
  await nav(page, 'Catálogo')
  await expect(page.getByRole('heading', { name: 'Próximas marcas que serão catalogadas' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cobertura por versão e ano' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Buscar manuais no catálogo' })).toHaveCount(0)
  await selectFipe(page, familyRequests, false)
  const select = (name) => page.getByRole('combobox', { name, exact: true })
  await select('Ano-modelo').selectOption('2013')
  await expect(select('Modelo').locator('option')).toHaveText(['Selecione', 'Palio Fire 1.0 Flex 8V Hatch 3p · Flex'])
  await expect(page.getByRole('link', { name: 'Visualizar manual' })).toHaveCount(0)
  await expect(page.getByText('R$ 25.000,00', { exact: true })).toHaveCount(0)
  await select('Carro').selectOption('uno')
  await expect(select('Ano-modelo').locator('option:not([value=""])')).toHaveText(['2012'])
  await expect(select('Ano-modelo')).toHaveValue('')
  await expect(select('Modelo')).toHaveCount(0)
  await select('Marca FIPE').selectOption('59')
  await expect(select('Ano-modelo')).toBeDisabled()
  await select('Carro').selectOption('fox')
  await expect(select('Ano-modelo').locator('option:not([value=""])')).toHaveText(['2018'])
  expect(familyRequests).toEqual(['21/palio', '21/palio/2015', '21/palio/2013', '21/uno', '59/fox'])
  expect(stateRequests).toEqual(['GET'])
  await expect(page.getByRole('heading', { name: 'Fontes registradas' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Contribuir com uma fonte' })).toHaveCount(0)
})

test('uma edição pendente sobrevive ao recarregamento e chega ao servidor', async ({ page, request }) => {
  await seed(request)
  const mileageRoute = '**/api/state/mileage'
  await page.route(mileageRoute, (route) => route.fulfill({ status: 503, json: { error: 'Falha de teste' } }))
  await page.goto('/')
  await button(page, 'Atualizar quilometragem').click()
  await page.getByLabel('Quilometragem atual').fill('12500')
  const rejected = page.waitForResponse((response) => response.url().endsWith('/api/state/mileage') && response.status() === 503)
  await button(page, 'Salvar quilometragem').click()
  await rejected
  expect((await (await request.get('/api/state')).json()).mileage).toBe(10000)
  await expect(page.getByText('12.500 km', { exact: true })).toBeVisible()
  await page.unroute(mileageRoute)
  await page.reload()
  await expect(page.getByText('12.500 km', { exact: true })).toBeVisible()
  await expect.poll(async () => (await (await request.get('/api/state')).json()).mileage).toBe(12500)
})

test('mobile: navegação das seis áreas e edição do veículo pelo perfil', async ({ page, request }) => {
  await seed(request)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(button(page, 'Abrir menu')).toHaveAttribute('aria-expanded', 'false')
  for (const name of ['Manutenções', 'Gastos', 'Copiloto', 'Histórico', 'Catálogo', 'Início']) {
    await nav(page, name)
    await expect(button(page, 'Abrir menu')).toHaveAttribute('aria-expanded', 'false')
    await button(page, 'Abrir menu').click()
    await expect(button(page.getByRole('navigation', { name: 'Navegação principal' }), name)).toHaveAttribute('aria-current', 'page')
    await page.keyboard.press('Escape')
  }
  await nav(page, 'Copiloto')
  await page.getByLabel('Mensagem para o Copiloto').fill('Qual a quilometragem do carro?')
  await button(page, 'Enviar mensagem').click()
  await expect(page.locator('.chat-bubble.assistant')).toContainText('10.000 km')
  await nav(page, 'Início')
  await button(page, 'Abrir perfil').click()
  await button(dialog(page), 'Editar veículo').click()
  await dialog(page).getByLabel('Placa').fill('abc1d24')
  await button(dialog(page), 'Salvar veículo').click()
  await expect(page.locator('.hero-card').getByText(/ABC1D24/)).toBeVisible()
})
