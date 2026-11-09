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
  await page.route('**/api/fipe/cars?**', async (route) => {
    const query = new URL(route.request().url()).searchParams
    const json = query.has('year')
      ? { brand: 'Fiat', model: 'Palio Fire', modelYear: 2015, fuel: 'Flex', price: 'R$ 25.000,00', referenceMonth: 'novembro de 2026', codeFipe: '001269-6' }
      : query.has('model') ? [{ code: '2015-1', name: '2015 Flex' }]
        : query.has('brand') ? [{ code: '10', name: 'Palio Fire' }] : [{ code: '21', name: 'Fiat' }]
    await route.fulfill({ json })
  })
}
async function selectFipe(page) {
  await button(page, 'Consultar Tabela FIPE').click()
  await page.getByRole('combobox', { name: 'Marca FIPE', exact: true }).selectOption('21')
  await page.getByRole('combobox', { name: 'Modelo FIPE', exact: true }).selectOption('10')
  await page.getByLabel('Ano e combustível').selectOption('2015-1')
  await expect(page.getByText('R$ 25.000,00', { exact: true })).toBeVisible()
}

test('cadastro: consulta FIPE, volta, confirma e preserva o perfil ao recarregar', async ({ page, request }) => {
  await seed(request, { profile: null, vehicle: null })
  await mockFipe(page)
  await page.goto('/')
  await expect(button(page, 'Continuar')).toBeDisabled()
  await selectFipe(page)
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
  await page.locator('.sidebar-vehicle').click()
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
  await button(page, 'Quanto gastei este mês?').click()
  await expect(page.locator('.chat-bubble.assistant').first()).toContainText('180,00')
  await page.getByLabel('Mensagem para o Copiloto').fill('Qual a quilometragem do carro?')
  await button(page, 'Enviar mensagem').click()
  await expect(page.locator('.chat-bubble.assistant').last()).toContainText('12.000 km')
  await nav(page, 'Início')
  await expect(page.getByText('12.000 km', { exact: true })).toBeVisible()
})

test('catálogo: busca, erro, nova tentativa, FIPE e envio de fonte', async ({ page, request }) => {
  await seed(request)
  await mockFipe(page)
  await page.goto('/')
  await nav(page, 'Catálogo')
  await expect(page.getByRole('heading', { name: '30 marcas na cobertura inicial' })).toBeVisible()
  const search = '**/api/catalog/search?**'
  await page.route(search, (route) => route.fulfill({ status: 503, json: {} }))
  await page.getByLabel('Buscar marca ou modelo').fill('Palio')
  await expect(page.getByRole('alert')).toContainText('Não foi possível buscar')
  await page.unroute(search)
  await button(page, 'Buscar').click()
  await expect(page.getByText(/Nenhum modelo revisado encontrado/)).toBeVisible()
  await selectFipe(page)
  await button(page, 'Fechar consulta FIPE').click()
  const form = page.locator('.catalog-contribution')
  await form.getByLabel('Marca', { exact: true }).fill('Fiat')
  await form.getByLabel('Título da fonte').fill('Documento de teste')
  await form.getByLabel('Link público').fill('https://example.test/manual')
  const submit = button(form, 'Enviar para revisão')
  const contribution = '**/api/catalog/contributions'
  await page.route(contribution, (route) => route.fulfill({ status: 503, json: {} }))
  await submit.click()
  await expect(page.getByText(/Não foi possível registrar/)).toBeVisible()
  await expect(form.getByLabel('Título da fonte')).toHaveValue('Documento de teste')
  await page.unroute(contribution)
  await submit.click()
  await expect(form.getByLabel('Título da fonte')).toHaveValue('')
  await expect(page.getByText('Fonte enviada para revisão do catálogo')).toBeVisible()
})

test('mobile: navegação das seis áreas e edição do veículo pelo perfil', async ({ page, request }) => {
  await seed(request)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Navegação principal', exact: true })).toBeVisible()
  for (const name of ['Manutenções', 'Gastos', 'Copiloto', 'Histórico', 'Catálogo', 'Início']) {
    await nav(page, name)
    await expect(button(page.getByRole('navigation', { name: 'Navegação principal' }), name)).toHaveClass('selected')
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
