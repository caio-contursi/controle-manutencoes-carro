import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, Car, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3,
  Droplet, FileText, Fuel, Gauge, History, Home, Info, KeyRound, Map, Menu,
  MessageCircle, MoreHorizontal, Pencil, Plus, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, Wallet, Wrench, X, Zap,
} from 'lucide-react'
import './styles.css'

const navItems = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'manutencoes', label: 'Manutenções', icon: Wrench },
  { id: 'gastos', label: 'Gastos', icon: Wallet },
  { id: 'copiloto', label: 'Copiloto', icon: MessageCircle },
  { id: 'historico', label: 'Histórico', icon: FileText },
]

const initialMaintenance = [
  { title: 'Troca de velas de ignição', detail: '30.000 km · 36 meses', icon: Zap, status: 'Aguardando calibração', km: 30000 },
  { title: 'Troca da correia dentada', detail: '40.000 km · 48 meses', icon: Settings2, status: 'Aguardando calibração', km: 40000 },
  { title: 'Rodízio de pneus', detail: '10.000 km · 12 meses', icon: CircleHelp, status: 'Aguardando calibração', km: 10000 },
  { title: 'Troca de filtro de combustível', detail: '10.000 km · 12 meses', icon: SlidersHorizontal, status: 'Aguardando calibração', km: 10000 },
  { title: 'Troca de óleo do motor', detail: '10.000 km · 12 meses', icon: Droplet, status: 'Aguardando calibração', km: 10000 },
  { title: 'Alinhamento e balanceamento', detail: '10.000 km · 12 meses', icon: Settings2, status: 'No plano', km: 10000 },
]

const firstSteps = [
  'Informe a quilometragem atual', 'Calibre seu plano', 'Ligue os avisos',
  'Registre o primeiro abastecimento', 'Registre a 1ª manutenção', 'Adicione um lembrete',
]

const referenceFiles = Object.keys(import.meta.glob('/public/references/*', { eager: false }))
  .map((path) => path.split('/').pop())
  .filter(Boolean)
  .sort((a, b) => {
    const match = (file) => {
      const [, hh = '0', mm = '0', ss = '0', copy = '0'] = file.match(/at (\d+)\.(\d+)\.(\d+)(?: \((\d+)\))?/) || []
      return [Number(hh), Number(mm), Number(ss), Number(copy)]
    }
    const first = match(a)
    const second = match(b)
    for (let index = 0; index < first.length; index += 1) if (first[index] !== second[index]) return first[index] - second[index]
    return a.localeCompare(b, 'pt-BR')
  })

function loadState(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function usePersistentState(key, fallback) {
  const [state, setState] = useState(() => loadState(key, fallback))
  const [hydrated, setHydrated] = useState(false)
  const shortKey = key.replace('lembracar.', '')
  useEffect(() => {
    let active = true
    fetch('/api/state').then((response) => response.ok ? response.json() : Promise.reject(new Error('API indisponível'))).then((stored) => {
      if (!active) return
      if (Object.prototype.hasOwnProperty.call(stored, shortKey)) {
        localStorage.setItem(key, JSON.stringify(stored[shortKey]))
        setState(stored[shortKey])
      }
    }).catch(() => {}).finally(() => { if (active) setHydrated(true) })
    return () => { active = false }
  }, [key, shortKey])
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)) }, [key, state])
  useEffect(() => {
    if (hydrated) fetch(`/api/state/${shortKey}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: state }) }).catch(() => {})
  }, [hydrated, key, shortKey, state])
  return [state, setState]
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function App() {
  const [profile, setProfile] = usePersistentState('lembracar.profile', null)
  const [vehicle, setVehicle] = usePersistentState('lembracar.vehicle', null)
  const [mileage, setMileage] = usePersistentState('lembracar.mileage', 245000)
  const [maintenance, setMaintenance] = usePersistentState('lembracar.maintenance', initialMaintenance)
  const [expenses, setExpenses] = usePersistentState('lembracar.expenses', [])
  const [reminders, setReminders] = usePersistentState('lembracar.reminders', [])
  const [firstDone, setFirstDone] = usePersistentState('lembracar.firstSteps', [true, false, false, false, false, false])
  const [page, setPage] = useState(() => localStorage.getItem('lembracar.page') || (loadState('lembracar.vehicle', null) ? 'inicio' : 'onboarding'))
  const [dark, setDark] = usePersistentState('lembracar.dark', false)
  const [fabOpen, setFabOpen] = useState(false)
  const [modal, setModal] = useState('')
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [conversation, setConversation] = useState([])
  const [plate, setPlate] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [plateLookup, setPlateLookup] = useState(false)
  const [onStep, setOnStep] = useState(1)
  const [draft, setDraft] = useState({ make: 'Fiat', model: 'Palio', version: 'Palio 1.0 Fire Flex', year: '2012', city: 'Rio de Janeiro - RJ', name: '' })

  useEffect(() => {
    if (!profile || !vehicle) setPage('onboarding')
    else if (page === 'onboarding') setPage('inicio')
  }, [profile, vehicle])
  useEffect(() => { localStorage.setItem('lembracar.page', page) }, [page])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const monthExpenses = useMemo(() => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0), [expenses])
  const completedSteps = firstDone.filter(Boolean).length
  const completedMaintenance = maintenance.filter((item) => item.status === 'Concluída').length
  const awaitingMaintenance = maintenance.filter((item) => ['Aguardando calibração', 'Aguardando resposta'].includes(item.status)).length

  const movePage = (next) => { setPage(next); setFabOpen(false); setModal('') }
  const completeOnboarding = () => {
    const cleanPlate = plate.replace(/[^a-z0-9]/gi, '').toUpperCase() || 'KOQ2B84'
    const { phone: _phone, ...vehicleDraft } = draft
    setVehicle({ ...vehicleDraft, plate: cleanPlate, brand: draft.make, name: draft.model })
    setProfile({ name: draft.name.trim() || 'Rafael' })
    setFirstDone([true, false, false, false, false, false])
    movePage('inicio')
    setToast('Seu Palio já está sendo monitorado')
  }
  const markStep = (index) => {
    if (firstDone[index]) return
    if (index === 1) setModal('calibrate')
    else if (index === 2) {
      setFirstDone((old) => { const next = [...old]; next[index] = true; return next })
      setToast('Avisos ativados para as próximas manutenções')
    } else if (index === 3) setModal('expense')
    else if (index === 4) setModal('maintenance')
    else if (index === 5) setModal('reminder')
  }
  const saveMileage = (value) => {
    const nextValue = Number(value)
    setMileage(nextValue)
    setFirstDone((old) => { const next = [...old]; next[0] = true; return next })
    setToast('Quilometragem atualizada')
  }
  const calibrate = () => {
    setMaintenance(initialMaintenance.slice(0, 5).map((item, index) => ({ ...item, status: index < 2 ? 'Aguardando resposta' : 'No plano' })))
    setFirstDone((old) => { const next = [...old]; next[1] = true; return next })
    setModal('')
    setToast('Seu plano ficou pronto com 17 manutenções')
  }
  const submitExpense = (data) => {
    setExpenses((old) => [{ ...data, id: crypto.randomUUID(), date: new Date().toISOString() }, ...old])
    if (data.type === 'Abastecimento') setFirstDone((old) => { const next = [...old]; next[3] = true; return next })
    setModal('')
    setToast('Gasto registrado')
  }
  const removeExpense = (id) => {
    const removed = expenses.find((item) => item.id === id)
    setExpenses((old) => old.filter((item) => item.id !== id))
    if (removed?.type === 'Abastecimento') setFirstDone((old) => { const next = [...old]; next[3] = expenses.some((item) => item.id !== id && item.type === 'Abastecimento'); return next })
    setToast('Gasto removido do extrato')
  }
  const submitMaintenance = (title, amount, recordedMileage = mileage) => {
    const serviceMileage = Number(recordedMileage || mileage)
    setMileage(serviceMileage)
    setMaintenance((old) => [{ title, detail: `${serviceMileage.toLocaleString('pt-BR')} km · Hoje`, icon: Wrench, status: 'Concluída', km: serviceMileage, amount, completedAt: new Date().toISOString() }, ...old])
    setFirstDone((old) => { const next = [...old]; next[4] = true; return next })
    if (amount) setExpenses((old) => [{ id: crypto.randomUUID(), type: 'Manutenção', title, amount: Number(amount), date: new Date().toISOString() }, ...old])
    setModal('')
    setToast('Manutenção adicionada ao histórico')
  }
  const submitReminder = (title, date) => {
    setReminders((old) => [{ title, date, id: crypto.randomUUID() }, ...old])
    setFirstDone((old) => { const next = [...old]; next[5] = true; return next })
    setModal('')
    setToast('Lembrete criado')
  }
  const submitChat = (question = query) => {
    if (!question.trim()) return
    const prompt = question.trim()
    setConversation((old) => [...old, { role: 'user', text: prompt }])
    setQuery('')
    setTimeout(() => setConversation((old) => [...old, { role: 'assistant', text: answerFor(prompt, mileage, monthExpenses) }]), 350)
  }
  const lookupPlate = () => {
    if (!plate.trim()) { setToast('Digite a placa do veículo'); return }
    setLookupBusy(true)
    setTimeout(() => {
      setLookupBusy(false)
      setPlateLookup(true)
      setToast('Veículo encontrado. Confira os dados para continuar.')
    }, 800)
  }

  return (
    <main className={`app-shell ${dark ? 'dark' : ''} ${page === 'onboarding' ? 'onboarding-shell' : ''}`}>
      {page === 'onboarding' ? (
        <Onboarding step={onStep} setStep={setOnStep} draft={draft} setDraft={setDraft} plate={plate} setPlate={setPlate} busy={lookupBusy} lookedUp={plateLookup} onLookup={lookupPlate} onFinish={completeOnboarding} onToast={setToast} onEnter={() => { setProfile({ name: 'Rafael' }); setVehicle({ brand: 'Fiat', model: 'Palio', version: 'Palio 1.0 Fire Flex', year: '2012', city: 'Rio de Janeiro - RJ', plate: 'KOQ2B84' }); movePage('inicio') }} />
      ) : (
        <>
          <div className="phone-status"><span>16:53 ◐</span><span className="signal">▮▮▮ ◉ ▰</span></div>
          <DesktopSidebar page={page} profile={profile} vehicle={vehicle} onNavigate={movePage} onProfile={() => setModal('profile')} />
          <div className="app-main">
            <Header page={page} vehicle={vehicle} dark={dark} setDark={setDark} profile={profile} onProfile={() => setModal('profile')} onReminders={() => setModal('notifications')} />
            <section className={`screen-content ${page === 'inicio' || page === 'manutencoes' && dark ? 'screen-dark' : ''}`} key={page}>
              {page === 'inicio' && <HomePage vehicle={vehicle} profile={profile} mileage={mileage} setMileage={setMileage} maintenance={maintenance} firstDone={firstDone} completedSteps={completedSteps} completedMaintenance={completedMaintenance} awaitingMaintenance={awaitingMaintenance} onMileageSave={saveMileage} onStep={markStep} onOpen={movePage} onToast={setToast} reminders={reminders} />}
              {page === 'manutencoes' && <MaintenancePage maintenance={maintenance} onComplete={(item) => submitMaintenance(item.title, '')} onPremium={() => setModal('premium')} onCalibrate={() => setModal('calibrate')} onReminder={() => setModal('reminder')} onManual={() => setModal('maintenance')} dark={dark} setDark={setDark} />}
              {page === 'gastos' && <ExpensesPage expenses={expenses} total={monthExpenses} onAdd={() => setModal('expense')} onRemove={removeExpense} />}
              {page === 'copiloto' && <CopilotPage vehicle={vehicle} profile={profile} mileage={mileage} conversation={conversation} query={query} setQuery={setQuery} onSubmit={submitChat} onSuggestion={submitChat} />}
              {page === 'historico' && <HistoryPage maintenance={maintenance} expenses={expenses} reminders={reminders} firstDone={firstDone} completedSteps={completedSteps} onRegister={() => setModal('maintenance')} />}
            </section>
            {fabOpen && <div className="fab-menu">
              <button onClick={() => setModal('reminder')}>Criar novo lembrete <CalendarDays size={17} /></button>
              <button onClick={() => setModal('maintenance')}>Registrar manutenção feita <Check size={17} /></button>
              <button onClick={() => setModal('expense')}>Registrar gasto <Wallet size={17} /></button>
            </div>}
            <button className={`fab ${fabOpen ? 'fab-open' : ''}`} aria-label={fabOpen ? 'Fechar ações' : 'Adicionar'} onClick={() => setFabOpen(!fabOpen)}>{fabOpen ? <X size={25} /> : <Plus size={26} />}</button>
            <BottomNav page={page} onNavigate={movePage} />
          </div>
        </>
      )}
      {modal && <Modal name={modal} close={() => setModal('')} onExpense={submitExpense} onMaintenance={submitMaintenance} onReminder={submitReminder} onCalibrate={calibrate} onToast={setToast} profile={profile} setProfile={setProfile} mileage={mileage} setMileage={setMileage} />}
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
    </main>
  )
}

function answerFor(question, mileage, spend) {
  const lower = question.toLowerCase()
  if (lower.includes('gasto') || lower.includes('gaste')) return `Neste mês você registrou ${money(spend)} em gastos do seu carro. Anote cada abastecimento e manutenção para acompanhar sua média ao longo do tempo.`
  if (lower.includes('óleo')) return `Confira a última troca de óleo no histórico do veículo. Como referência, o intervalo depende do motor e da recomendação do fabricante. Seu Palio está com ${Number(mileage).toLocaleString('pt-BR')} km; confirme a especificação no manual ou com um mecânico.`
  if (lower.includes('vencid') || lower.includes('atras')) return 'Pelo plano que montamos, há manutenções aguardando calibração. Informe o que já foi feito para ajustar os prazos do seu Palio.'
  if (lower.includes('carro') || lower.includes('palio')) return `Seu Fiat Palio está com ${Number(mileage).toLocaleString('pt-BR')} km informados. Posso ajudar a organizar o plano, entender os gastos ou consultar os registros que você adicionou.`
  return 'Posso ajudar a entender o plano de manutenção, acompanhar seus gastos e organizar os cuidados do Palio. Para uma orientação mecânica, confirme sempre com um profissional de confiança.'
}

function Header({ page, vehicle, dark, setDark, profile, onProfile, onReminders }) {
  const pageNames = { inicio: `Boa tarde, ${profile?.name || 'caio'}`, manutencoes: 'Manutenções', gastos: 'Gastos', copiloto: 'Copiloto', historico: 'Histórico' }
  const isDarkHeader = page === 'inicio' || page === 'gastos' || page === 'copiloto' || (page === 'manutencoes' && dark)
  return (
    <header className={`app-header ${isDarkHeader ? 'header-dark' : ''}`}>
      <div className="brand-row">
        <div className="brand-symbol">ℒ</div>
        <div className="brand-title-wrap"><strong>{pageNames[page]}</strong>{vehicle && <span>{vehicle.brand} {vehicle.model}<i>+ veículo</i></span>}</div>
        {page === 'manutencoes' && <label className="tiny-toggle" title="Modo severo"><input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} /><span /></label>}
        {page === 'copiloto' && <div className="brand-wordmark">LembraCar</div>}
        <div className="header-actions">{page !== 'copiloto' && <button className="icon-button notification-icon" aria-label="Notificações" onClick={onReminders}><Bell size={18} /><b>1</b></button>}<button className="avatar-button" onClick={onProfile} aria-label="Abrir perfil">{(vehicle?.model || 'C').slice(0, 1)}</button></div>
      </div>
    </header>
  )
}

function BottomNav({ page, onNavigate }) {
  return <nav className="bottom-nav" aria-label="Navegação principal">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'selected' : ''} onClick={() => onNavigate(id)}><Icon size={20} strokeWidth={page === id ? 2.5 : 1.8} /><span>{label}</span></button>)}</nav>
}

function DesktopSidebar({ page, profile, vehicle, onNavigate, onProfile }) {
  return <aside className="desktop-sidebar">
    <button className="sidebar-brand" onClick={() => onNavigate('inicio')}><span className="brand-symbol">ℒ</span><strong>LembraCar</strong></button>
    <div className="sidebar-label">MENU PRINCIPAL</div>
    <nav aria-label="Navegação para desktop">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => onNavigate(id)}><Icon size={19} /><span>{label}</span>{id === 'manutencoes' && <i>5</i>}</button>)}</nav>
    <div className="sidebar-vehicle"><span className="sidebar-car"><Car size={20} /></span><div><b>{vehicle?.brand} {vehicle?.model}</b><small>{vehicle?.plate} · {vehicle?.year}</small></div><ChevronDown size={15} /></div>
    <button className="sidebar-profile" onClick={onProfile}><span className="avatar-button">{(profile?.name || 'R').slice(0, 1)}</span><span><b>{profile?.name || 'Rafael'}</b><small>Meu perfil</small></span><MoreHorizontal size={17} /></button>
  </aside>
}

function HomePage({ vehicle, profile, mileage, setMileage, maintenance, firstDone, completedSteps, completedMaintenance, awaitingMaintenance, onMileageSave, onStep, onOpen, onToast, reminders }) {
  const [editing, setEditing] = useState(false)
  const remaining = awaitingMaintenance
  const shown = vehicle?.model || 'Palio'
  return <div className="home-stack">
    <section className="hero-card">
      <div className="hero-greeting">{`Olá, ${profile?.name || 'caio'}.`} <span>Cuide do seu carro sem deixar nada para depois.</span></div>
      <div className="hero-vehicle"><div className="car-tile"><Car size={29} /></div><div className="vehicle-name"><small>{vehicle?.brand || 'FIAT'}</small><strong>{shown}<span className="model-plus">+</span></strong><small>{vehicle?.plate || 'KOQ2B84'} · {vehicle?.year || '2012'}</small></div><div className="health-ring"><span>—</span><small>SAÚDE</small></div></div>
      <button className="waiting-line" onClick={() => onOpen('manutencoes')}><Clock3 size={15} /><b>{remaining || 5} manutenções aguardam resposta</b><ChevronRight size={16} /></button>
      <div className="odometer-block"><strong>{Number(mileage).toLocaleString('pt-BR')} km</strong><span>no odômetro</span></div>
      <div className="metrics-row"><div><Gauge size={15} /><span>33 km/dia<small>ritmo de uso</small></span><button aria-label="Editar ritmo" onClick={() => onToast('Ritmo de uso calculado pela quilometragem informada')}><Pencil size={12} /></button></div><div><Fuel size={15} /><span>—<small>consumo real</small></span></div></div>
      <button className="yellow-button update-mileage" onClick={() => setEditing(!editing)}>{editing ? 'Salvar quilometragem' : 'Atualizar quilometragem'} <Gauge size={16} /></button>
      {editing && <div className="inline-mileage"><input aria-label="Quilometragem atual" type="number" value={mileage} onChange={(event) => setMileage(Number(event.target.value))} /><span>km</span><button onClick={() => { onMileageSave(mileage); setEditing(false) }}><Check size={17} /></button></div>}
    </section>
    <section className="surface-card steps-card">
      <div className="card-heading"><div><h2>Primeiros passos</h2><p>{completedSteps} de {firstSteps.length}</p></div><ChevronDown size={17} /></div>
      <div className="progress-track"><i style={{ width: `${completedSteps / firstSteps.length * 100}%` }} /></div>
      <div className="steps-list">{firstSteps.map((title, i) => <button className="step-row" key={title} onClick={() => i === 0 ? setEditing(true) : onStep(i)}><span className={`check-circle ${firstDone[i] ? 'checked' : ''}`}>{firstDone[i] && <Check size={13} />}</span><span className={firstDone[i] ? 'done-text' : ''}>{title}</span>{!firstDone[i] && <ChevronRight size={15} />}</button>)}</div>
    </section>
    <section className="surface-card summary-card"><div className="card-heading"><div><h2>Resumo das manutenções</h2><p>Do seu {shown}</p></div><Wrench size={18} /></div><div className="summary-stats"><div className="stat-red"><b>{Math.min(5, remaining)}</b><span>atrasadas</span></div><div className="stat-amber"><b>{maintenance.filter((item) => item.status === 'Em breve').length}</b><span>em breve</span></div><div className="stat-green"><b>{completedMaintenance}</b><span>em dia</span></div></div><button className="text-link" onClick={() => onOpen('manutencoes')}>Ver plano completo <ArrowRight size={15} /></button></section>
    {reminders.length > 0 && <section className="surface-card summary-card"><h2>Seus lembretes</h2>{reminders.map((item) => <p className="reminder-row" key={item.id}><CalendarDays size={16} />{item.title}</p>)}</section>}
    <section className="support-card"><ShieldCheck size={18} /><div><strong>Seu carro em boas mãos</strong><span>Consulte o plano, registre serviços e acompanhe tudo por aqui.</span></div><Info size={16} /></section>
  </div>
}

function MaintenancePage({ maintenance, onComplete, onPremium, onCalibrate, onReminder, onManual, dark, setDark }) {
  const [tab, setTab] = useState('manutencoes')
  const [filter, setFilter] = useState('todas')
  const countComplete = maintenance.filter((item) => item.status === 'Concluída').length
  const revisionItems = maintenance.filter((item) => item.title.toLowerCase().includes('revis'))
  const sourceList = tab === 'revisoes' ? revisionItems : maintenance
  const list = filter === 'atrasadas' ? sourceList.filter((item) => item.status === 'Atrasada') : filter === 'em breve' ? sourceList.filter((item) => item.status === 'Em breve') : filter === 'em dia' ? sourceList.filter((item) => item.status === 'Concluída') : sourceList
  return <div className="page-content maintenance-page">
    <div className="segment-control"><button className={tab === 'manutencoes' ? 'active' : ''} onClick={() => setTab('manutencoes')}>Manutenções <span>17</span></button><button className={tab === 'revisoes' ? 'active' : ''} onClick={() => setTab('revisoes')}>Revisões</button></div>
    <section className="surface-card calibration-card"><div className="calibrate-header"><span className="round-icon"><CircleHelp size={18} /></span><div><strong>Calibrar seu plano</strong><small>Faltam 5 · Leva uns 2 minutos</small></div></div><p>Responda o que já fez para ajustarmos os prazos de cada manutenção.</p><button className="yellow-button" onClick={onCalibrate}>Calibrar <SlidersHorizontal size={16} /></button></section>
    <div className="filter-chips">{['Todas', 'Atrasadas', 'Em breve', 'Em dia'].map((value) => { const key = value.toLowerCase(); const count = value === 'Todas' ? maintenance.length : value === 'Atrasadas' ? maintenance.filter((item) => item.status === 'Atrasada').length : value === 'Em breve' ? maintenance.filter((item) => item.status === 'Em breve').length : countComplete; return <button key={value} className={filter === key ? 'chip-active' : ''} onClick={() => setFilter(key)}><ShieldCheck size={12} />{value === 'Todas' ? `Todas ${count}` : `${value} ${count}`}</button> })}</div>
    <div className="list-intro"><span>SEU PLANO TEM 17</span><span>{countComplete} concluídas · 12 completas no Premium</span></div>
    {tab === 'revisoes' && revisionItems.length === 0 && <section className="surface-card revision-empty"><CalendarDays size={19} /><b>Nenhuma revisão registrada ainda</b><span>Adicione uma revisão no histórico para acompanhá-la aqui.</span></section>}
    <div className="maintenance-list">{list.map((item, i) => { const Icon = typeof item.icon === 'function' ? item.icon : Wrench; return <button className={`maintenance-row ${item.status === 'Concluída' ? 'row-complete' : ''}`} key={`${item.title}-${i}`} onClick={() => onComplete(item)}><span className="maintenance-icon"><Icon size={17} /></span><span className="maintenance-copy"><b>{item.title}</b><small>{item.detail}</small></span><span className="maintenance-status">{item.status}<ChevronRight size={15} /></span></button> })}</div>
    <button className="premium-bar" onClick={onPremium}><span>♛ +12 manutenções do manual</span><ArrowRight size={16} /></button>
    <section className="surface-card next-review"><div className="card-heading"><div><h2>Próxima revisão</h2><p>Exemplo · plano preventivo</p></div><Sparkles size={18} /></div><p>Organize os cuidados do seu {countComplete ? 'Palio' : 'carro'} e acompanhe o que vem a seguir.</p><button className="yellow-button" onClick={onReminder}>Organizar minha próxima revisão <ArrowRight size={16} /></button></section>
    <div className="inline-severe"><span>Modo severo</span><label className="tiny-toggle"><input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} /><span /></label></div>
  </div>
}

function ExpensesPage({ expenses, total, onAdd, onRemove }) {
  const [view, setView] = useState('extrato')
  const buckets = expenses.reduce((acc, item) => { acc[item.type] = (acc[item.type] || 0) + Number(item.amount); return acc }, {})
  return <div className="page-content expenses-page">
    <div className="segment-control"><button className={view === 'extrato' ? 'active' : ''} onClick={() => setView('extrato')}><Menu size={14} />Extrato</button><button className={view === 'graficos' ? 'active' : ''} onClick={() => setView('graficos')}><SlidersHorizontal size={14} />Gráficos</button></div>
    <section className="surface-card month-total"><small>ESTE MÊS</small><strong>{money(total)}</strong><p>No mesmo passo de setembro.</p><div className="month-stat"><div><b>{expenses.length}</b><span>LANÇAMENTOS</span></div><div><b>{expenses.length ? money(total / expenses.length) : '—'}</b><span>TICKET MÉDIO</span></div></div></section>
    {view === 'graficos' ? <section className="surface-card chart-card"><h2>Seus gastos por categoria</h2>{['Abastecimento', 'Manutenção', 'Gasto avulso', 'Conta fixa'].map((type) => <div className="chart-row" key={type}><span>{type}</span><div className="chart-track"><i style={{ width: `${total ? Math.max(8, (buckets[type] || 0) / total * 100) : 3}%` }} /></div><b>{money(buckets[type] || 0)}</b></div>)}<p className="muted-note">Os gráficos ficam mais completos quando você registrar seus gastos.</p></section> : expenses.length ? <section className="surface-card expenses-list"><h2>Seu extrato</h2>{expenses.map((item) => <div className="expense-row" key={item.id}><span className="round-icon"><Wallet size={17} /></span><span><b>{item.title}</b><small>{item.type} · {new Date(item.date).toLocaleDateString('pt-BR')}</small></span><strong>{money(item.amount)}</strong><button className="remove-expense" title={`Remover ${item.title}`} aria-label={`Remover ${item.title}`} onClick={() => onRemove(item.id)}><X size={15} /></button></div>)}</section> : <section className="surface-card empty-expenses"><div className="empty-wallet"><Wallet size={27} /></div><h2>Todo custo do seu Palio, num lugar só.</h2><p>Abastecimentos, seguro, IPVA e manutenção, tudo somado por mês.</p><button className="yellow-button" onClick={onAdd}>Registrar primeiro gasto <Plus size={16} /></button></section>}
    <button className="quick-add-expense" onClick={onAdd}><Plus size={23} /></button>
  </div>
}

function CopilotPage({ vehicle, profile, mileage, conversation, query, setQuery, onSubmit, onSuggestion }) {
  const suggestions = ['O que está vencido?', 'Como meu carro está?', 'Quais gastos pesam mais?', 'Tem algo esse mês?']
  return <div className="page-content copilot-page">
    <div className="copilot-intro"><div className="copilot-avatar">ℒ</div><h1>Oi, {profile?.name || 'caio'}. Eu já li o histórico do seu {vehicle?.model || 'Palio'}.</h1><p>São 17 manutenções no radar e {Number(mileage).toLocaleString('pt-BR')} km rodados. Pergunte com suas palavras, ou toque em uma sugestão.</p></div>
    {conversation.length === 0 ? <><h2 className="section-title">Sugestões para começar</h2><div className="suggestion-grid">{suggestions.map((text, i) => <button key={text} className="suggestion-card" onClick={() => onSuggestion(text)}><span className="suggestion-dot">{['⚠', '◎', '↗', '⌕'][i]}</span><b>{text}</b><ChevronRight size={14} /></button>)}</div></> : <div className="conversation-list">{conversation.map((message, i) => <div key={i} className={`chat-bubble ${message.role}`}>{message.text}</div>)}</div>}
    <section className="recent-conversations"><h2>Conversas recentes</h2><div className="recent-empty"><MessageCircle size={23} /><span>{conversation.length ? 'Esta conversa está em andamento' : 'Restam 3 perguntas neste mês.'}</span></div></section>
    <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); onSubmit() }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pergunte ao Copiloto..." aria-label="Mensagem para o Copiloto" /><button aria-label="Enviar mensagem"><ArrowRight size={19} /></button></form><small className="copilot-footnote">O Copiloto pode errar. Confirme com um mecânico.</small>
  </div>
}

function HistoryPage({ maintenance, expenses, reminders, firstDone, completedSteps, onRegister }) {
  const hasRecords = maintenance.some((item) => item.status === 'Concluída') || expenses.length > 0 || reminders.length > 0
  const steps = ['Conta criada', 'Palio monitorado', 'Plano de manutenção', 'Informe a quilometragem', 'Registre o 1º abastecimento', 'Registre a 1ª manutenção']
  const historyProgress = Math.max(3, completedSteps)
  return <div className="page-content history-page">
    {hasRecords && <section className="surface-card report-card"><div className="report-kicker">LAUDO DE MANUTENÇÕES</div><h2>Mostre que seu Palio foi bem cuidado</h2><p>Cada manutenção registrada entra no PDF, pra mostrar na venda.</p><div className="report-preview"><div className="report-brand">ℒ <span>LembraCar</span></div><b>Histórico de Manutenção</b><span>Fiat PALIO FIRE ECONOMY 2012　 KOQ2B84</span><hr /><div>MANUTENÇÕES　　COM NOTA FISCAL　　INVESTIDOS</div><p>Seu laudo começa na primeira manutenção registrada.</p></div><button className="outline-button" onClick={onRegister}>Registrar manutenção <Plus size={16} /></button></section>}
    <section className="surface-card history-start"><div className="history-progress-heading"><h2>Seu Histórico está começando</h2><b>{historyProgress} de 6</b></div><p>Ele nasce com o cadastro e cresce a cada registro. Cada dado completa uma parte.</p><div className="progress-track"><i style={{ width: `${historyProgress / 6 * 100}%` }} /></div><div className="steps-list">{steps.map((step, index) => <div className="step-row" key={step}><span className={`check-circle ${firstDone[index] || index < 3 ? 'checked' : ''}`}>{(firstDone[index] || index < 3) && <Check size={13} />}</span><span className={firstDone[index] || index < 3 ? '' : 'muted-step'}>{step}</span></div>)}</div></section>
    <h2 className="section-title timeline-heading">Linha do tempo <small>{maintenance.filter((item) => item.status === 'Concluída').length} manutenções</small></h2>
    <section className="surface-card timeline-card"><b>{new Date().getFullYear()}</b><div className="timeline-item"><span className="timeline-pin">ℒ</span><div><strong>Histórico iniciado</strong><small>{new Date().toLocaleDateString('pt-BR')}</small></div></div>{maintenance.filter((item) => item.status === 'Concluída').map((item, i) => <div className="timeline-item" key={`${item.title}${i}`}><span className="timeline-pin timeline-check"><Check size={12} /></span><div><strong>{item.title}</strong><small>{new Date(item.completedAt || Date.now()).toLocaleDateString('pt-BR')} · {Number(mileageSafe(item.km)).toLocaleString('pt-BR')} km</small></div></div>)}{expenses.map((item) => <div className="timeline-item" key={item.id}><span className="timeline-pin"><Fuel size={12} /></span><div><strong>{item.title}</strong><small>{new Date(item.date).toLocaleDateString('pt-BR')}</small></div></div>)}</section>
  </div>
}

function mileageSafe(value) { return Number(value || 0) }

function Onboarding({ step, setStep, draft, setDraft, plate, setPlate, busy, lookedUp, onLookup, onFinish, onToast, onEnter }) {
  const [focusCity, setFocusCity] = useState(false)
  const set = (key, value) => setDraft((old) => ({ ...old, [key]: value }))
  const choices = {
    3: ['Quebra na estrada', 'Gastar demais com oficina', 'Segurança da família', 'Perder valor na revenda', 'Outros'],
    4: ['Menos de 3 meses', 'Cerca de 1 ano', 'Entre 1 e 5 anos', 'Mais de 5 anos'],
    5: ['Quase só fim de semana', 'Cidade, todo dia', 'Rodo bastante, viajo', 'Uso profissional'],
  }
  const [answers, setAnswers] = useState({})
  const titles = { 3: 'O que mais te preocupa no seu veículo?', 4: 'Há quanto tempo você tem esse carro?', 5: 'Como você usa o PALIO?' }
  const advance = () => {
    if (step === 1) { if (!plate.trim()) { onToast('Informe a placa do seu veículo'); return } if (!lookedUp) { onLookup(); return } }
    if (step === 7) { onFinish(); return }
    setStep(step + 1)
  }
  return <div className="onboarding">
    <div className="onboarding-top"><span className="phone-notch" /><button onClick={() => step === 1 ? onEnter() : setStep(step - 1)} aria-label="Voltar"><ArrowLeft size={21} /></button><div className="onboarding-top-brand">{step > 5 ? 'Seu mecânico' : ''}</div><button className="skip-button" onClick={() => step === 1 ? onEnter() : setStep(Math.min(step + 1, 7))}>{step === 1 ? 'Já tem conta? Entrar' : ''}</button></div>
    {step === 1 && <div className="onboarding-content plate-step"><small className="eyebrow">QUAL A PLACA DO SEU VEÍCULO?</small><h1>Qual a placa do seu veículo?</h1><p>Informe a placa para preencher um exemplo de veículo e revisar os dados antes de continuar.</p><label className="plate-input"><span>BRASIL</span><input aria-label="Placa do veículo" autoFocus value={plate} onChange={(event) => { setPlate(event.target.value.toUpperCase()); setDraft((old) => ({ ...old, plate: event.target.value.toUpperCase() })) }} maxLength={7} placeholder="ABC1D23" /></label><button className="no-plate" onClick={() => { setPlate('KOQ2B84'); setDraft((old) => ({ ...old, plate: 'KOQ2B84' })); onToast('Placa de demonstração preenchida; os dados não vêm de consulta externa.') }}><Search size={16} /> Não lembro a placa <ChevronRight size={15} /></button><div className="privacy-note"><Info size={13} /> Este protótipo não consulta uma base de placas.</div>{lookedUp && <div className="lookup-result"><CheckCircle2 size={18} /><span><b>Dados de demonstração · Fiat Palio 1.0 Fire Flex</b><small>2012 · Flex · valor FIPE ilustrativo R$ 26.010,00</small></span></div>}<button className="yellow-button onboarding-cta" disabled={busy} onClick={advance}>{busy ? 'Preparando exemplo…' : lookedUp ? 'Conferir veículo' : 'Ver veículo de exemplo'} <ArrowRight size={16} /></button></div>}
    {step === 2 && <div className="onboarding-content found-step"><small className="eyebrow">ACHAMOS SEU CARRO</small><Car size={42} /><h1>FIAT Palio 1.0 Fire Flex</h1><div className="fipe-card"><span>REFERÊNCIA FIPE</span><b>R$ 26.010,00</b><div><span>PLACA<br /><b>{plate || 'KOQ2B84'}</b></span><span>ANO<br /><b>2012</b></span><span>COMBUSTÍVEL<br /><b>Flex</b></span></div></div><p>Confira os dados e continue para personalizar seu plano.</p><button className="yellow-button onboarding-cta" onClick={advance}>Sim, é esse <Check size={17} /></button><button className="link-button" onClick={() => setStep(1)}>Não é esse</button></div>}
    {step === 3 && <OnboardingChoices title={titles[3]} subtitle="Sua resposta define o que o plano coloca em primeiro lugar." choices={choices[3]} selected={answers[step]} onSelect={(v) => setAnswers({ ...answers, [step]: v })} onNext={advance} />}
    {step === 4 && <OnboardingChoices title={titles[4]} subtitle="" choices={choices[4]} selected={answers[step]} onSelect={(v) => setAnswers({ ...answers, [step]: v })} onNext={advance} />}
    {step === 5 && <OnboardingChoices title={titles[5]} subtitle="Quem roda mais troca óleo antes. É isso que a gente ajusta." choices={choices[5]} selected={answers[step]} onSelect={(v) => setAnswers({ ...answers, [step]: v })} onNext={advance} />}
    {step === 6 && <div className="onboarding-content city-step"><small className="eyebrow">ÚLTIMOS AJUSTES</small><h1>Em que cidade você mora?</h1><p>Falta pouco pro plano do seu carro ficar pronto.</p><label className="form-field">Cidade <span>(opcional)</span><input autoFocus value={draft.city} onChange={(event) => set('city', event.target.value)} onFocus={() => setFocusCity(true)} /></label><button className="outline-button location-button" onClick={() => { set('city', 'Rio de Janeiro - RJ'); setFocusCity(false) }}><Map size={16} /> Usar minha localização <Settings2 size={15} /></button><label className="form-field">Seu WhatsApp <span>(opcional)</span><input type="tel" placeholder="(11) 98765-4321" onChange={(event) => set('phone', event.target.value)} /></label><p className="microcopy">Avisos por WhatsApp não estão conectados. O número informado não é salvo nem enviado.</p><button className="yellow-button onboarding-cta" onClick={advance}>Continuar <ArrowRight size={16} /></button></div>}
    {step === 7 && <div className="onboarding-content account-step"><div className="brand-mark-large">ℒ <span>LembraCar</span></div><h1>Seu mecânico<br /><mark>de bolso</mark></h1><p>Pela placa, a gente mostra o que o seu veículo já deveria ter trocado.</p><p>Leva 2 minutos.</p><div className="app-preview"><div><Car size={17} /> Palio · 2012</div><strong>54.260 km</strong><span>Resumo das manutenções　<span className="green">✓</span> em dia</span><span className="yellow-bar" /></div><button className="yellow-button onboarding-cta" onClick={onFinish}>Começar <ArrowRight size={17} /></button><button className="link-button" onClick={onEnter}>Já tem conta? Entrar</button></div>}
    <div className="onboarding-progress"><span style={{ width: `${Math.max(8, step / 7 * 100)}%` }} /></div>
  </div>
}

function OnboardingChoices({ title, subtitle, choices, selected, onSelect, onNext }) {
  return <div className="onboarding-content choices-step"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}<div className="choice-list">{choices.map((choice, index) => <button key={choice} className={`choice-row ${selected === choice ? 'choice-selected' : ''}`} onClick={() => onSelect(choice)}><span className="choice-icon">{[<ShieldCheck size={15} />, <Wallet size={15} />, <Car size={15} />, <Zap size={15} />, <MoreHorizontal size={15} />][index]}</span>{choice}<span className="radio-circle">{selected === choice && <i />}</span></button>)}</div><button className="yellow-button onboarding-cta" disabled={!selected} onClick={onNext}>Continuar <ArrowRight size={16} /></button></div>
}

function Modal({ name, close, onExpense, onMaintenance, onReminder, onCalibrate, onToast, profile, setProfile, mileage, setMileage }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('Abastecimento')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [mileageDraft, setMileageDraft] = useState(mileage)
  const [nameDraft, setNameDraft] = useState(profile?.name || '')
  const [checked, setChecked] = useState({})
  const submitExpense = (event) => { event.preventDefault(); if (!title.trim() || !amount) return; onExpense({ title: title.trim(), amount: Number(amount), type }) }
  const submitMaintenance = (event) => { event.preventDefault(); if (!title.trim()) return; onMaintenance(title.trim(), amount) }
  const submitReminder = (event) => { event.preventDefault(); if (!title.trim()) return; onReminder(title.trim(), date) }
  const modalTitles = { expense: 'Registrar gasto', maintenance: 'Registrar manutenção', reminder: 'Criar novo lembrete', calibrate: 'Calibrar seu plano', premium: 'As 12 manutenções do seu Palio', profile: 'Seu perfil', notifications: 'Avisos e lembretes' }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}><section className="modal-card"><div className="modal-handle" /><div className="modal-heading"><div><h2>{modalTitles[name]}</h2><p>Palio · KOQ2B84</p></div><button className="close-modal" onClick={close} aria-label="Fechar"><X size={19} /></button></div>
    {name === 'expense' && <form onSubmit={submitExpense}><label className="form-field">Tipo do gasto<select value={type} onChange={(e) => setType(e.target.value)}>{['Abastecimento', 'Manutenção', 'Gasto avulso', 'Conta fixa'].map((x) => <option key={x}>{x}</option>)}</select></label><label className="form-field">Descrição<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'Abastecimento' ? 'Gasolina, etanol…' : 'Ex.: troca de óleo'} required /></label><label className="form-field">Valor<input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 0,00" required /></label>{type === 'Abastecimento' && <><label className="form-field">Litros <span>(opcional)</span><input type="number" step="0.01" placeholder="Ex.: 38" /></label><label className="form-field">Quilometragem <span>(opcional)</span><input type="number" placeholder={String(mileage)} /></label></>}<button className="yellow-button modal-submit">Salvar gasto <Check size={17} /></button></form>}
    {name === 'maintenance' && <form onSubmit={(event) => { event.preventDefault(); if (title.trim()) onMaintenance(title.trim(), amount, mileageDraft) }}><label className="form-field">O que foi feito?<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: troca de óleo" required /></label><label className="form-field">Quilometragem<input type="number" value={mileageDraft} onChange={(e) => setMileageDraft(Number(e.target.value))} /></label><label className="form-field">Valor gasto <span>(opcional)</span><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 0,00" /></label><label className="check-option"><input type="checkbox" /> Tenho nota fiscal do serviço</label><button className="yellow-button modal-submit">Registrar manutenção <Check size={17} /></button></form>}
    {name === 'reminder' && <form onSubmit={submitReminder}><label className="form-field">O que lembrar?<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: revisão do carro" required /></label><label className="form-field">Quando?<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label className="check-option"><input type="checkbox" defaultChecked /> Receber um aviso no celular</label><button className="yellow-button modal-submit">Criar lembrete <CalendarDays size={17} /></button></form>}
    {name === 'calibrate' && <div className="calibrate-modal"><p>Quais destes serviços você já fez no seu Palio?</p>{initialMaintenance.slice(0, 5).map((item) => <label className="calibration-choice" key={item.title}><input type="checkbox" checked={!!checked[item.title]} onChange={(e) => setChecked({ ...checked, [item.title]: e.target.checked })} /><span>{item.title}<small>{item.detail}</small></span></label>)}<button className="yellow-button modal-submit" onClick={onCalibrate}>Montar meu plano <ArrowRight size={17} /></button><button className="link-button" onClick={close}>Agora não</button></div>}
    {name === 'premium' && <div className="premium-modal"><div className="premium-price"><span>ANUAL</span><strong>R$ 89,00<small>/ano</small></strong><p>Economize 25% em comparação com o plano mensal.</p></div><div className="premium-perks">{['Revisões automáticas', 'Laudo de Manutenções', 'Copiloto com IA', '12 manutenções do manual'].map((x) => <span key={x}><CheckCircle2 size={15} /> {x}</span>)}</div><button className="yellow-button modal-submit" onClick={() => { close(); onToast('A assinatura Premium ficará disponível em breve') }}>Assinar e liberar as 12 <ArrowRight size={17} /></button><button className="link-button" onClick={close}>Continuar no plano grátis</button></div>}
    {name === 'profile' && <form onSubmit={(e) => { e.preventDefault(); setProfile((old) => ({ ...old, name: nameDraft || 'Rafael' })); close(); onToast('Perfil atualizado') }}><label className="form-field">Seu nome<input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} /></label><label className="form-field">Seu veículo<input readOnly value="Fiat Palio 1.0 Fire Flex · 2012" /></label><button className="yellow-button modal-submit">Salvar perfil <Check size={17} /></button></form>}
    {name === 'notifications' && <div className="notification-list">{[{ title: 'Troca de óleo do motor', detail: 'Aguardando calibração' }, { title: 'Lembretes no celular', detail: 'Toque para ligar os avisos' }].map((item, i) => <button key={item.title} onClick={() => i === 1 && onToast('Avisos ativados para este veículo')}><span className="round-icon"><Bell size={17} /></span><span><b>{item.title}</b><small>{item.detail}</small></span><ChevronRight size={16} /></button>)}</div>}
  </section></div>
}

function createReferenceGallery() {
  if (!referenceFiles.length) return null
  return <aside className="reference-gallery"><details><summary><BookOpen size={15} /> Referências visuais <span>{referenceFiles.length}</span></summary><div className="reference-grid">{referenceFiles.map((file, index) => <a key={file} href={`/references/${encodeURIComponent(file)}`} target="_blank" rel="noreferrer" title={file}><img loading="lazy" src={`/references/${encodeURIComponent(file)}`} alt={`Referência visual ${index + 1}`} /><span>{String(index + 1).padStart(2, '0')}</span></a>)}</div></details></aside>
}

createRoot(document.getElementById('root')).render(<><App />{createReferenceGallery()}</>)
