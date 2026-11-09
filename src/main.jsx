import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarDays, Car, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3,
  Droplet, FileText, Fuel, Gauge, History, Home, Info, KeyRound, Map, Menu,
  MessageCircle, MoreHorizontal, Pencil, Plus, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, Wallet, Wrench, X, Zap,
} from 'lucide-react'
import { displayDate, historyEntries, mileageFromRecord } from './records.js'
import FipeLookup from './FipeLookup.jsx'
import './styles.css'

const navItems = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'manutencoes', label: 'Manutenções', icon: Wrench },
  { id: 'gastos', label: 'Gastos', icon: Wallet },
  { id: 'copiloto', label: 'Copiloto', icon: MessageCircle },
  { id: 'historico', label: 'Histórico', icon: FileText },
  { id: 'catalogo', label: 'Catálogo', icon: BookOpen },
]

const initialMaintenance = []

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
  return [state, setState, hydrated]
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function App() {
  const [profile, setProfile, profileReady] = usePersistentState('lembracar.profile', null)
  const [vehicle, setVehicle, vehicleReady] = usePersistentState('lembracar.vehicle', null)
  const [mileage, setMileage, mileageReady] = usePersistentState('lembracar.mileage', 0)
  const [maintenance, setMaintenance, maintenanceReady] = usePersistentState('lembracar.maintenance', initialMaintenance)
  const [expenses, setExpenses, expensesReady] = usePersistentState('lembracar.expenses', [])
  const [reminders, setReminders, remindersReady] = usePersistentState('lembracar.reminders', [])
  const [page, setPage] = useState(() => localStorage.getItem('lembracar.page') || (loadState('lembracar.vehicle', null) ? 'inicio' : 'onboarding'))
  const pageIsReady = profileReady && vehicleReady && mileageReady && maintenanceReady && expensesReady && remindersReady
  const [fabOpen, setFabOpen] = useState(false)
  const [modal, setModal] = useState('')
  const [serviceTitleDraft, setServiceTitleDraft] = useState({ title: '', km: 0 })
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [conversation, setConversation] = useState([])
  const [catalogData, setCatalogData] = useState({ brands: [], sources: [], counts: null })
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogResults, setCatalogResults] = useState([])
  const catalogRequest = useRef(0)
  const [catalogSearchStatus, setCatalogSearchStatus] = useState('idle')
  const [onStep, setOnStep] = useState(1)
  const [draft, setDraft] = useState({ make: '', model: '', version: '', year: '', city: '', name: '' })

  useEffect(() => {
    if (!pageIsReady) return
    if (!profile || !vehicle) setPage('onboarding')
    else if (page === 'onboarding') setPage('inicio')
  }, [pageIsReady, profile, vehicle, page])
  useEffect(() => { localStorage.setItem('lembracar.page', page) }, [page])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    Promise.all([fetch('/api/catalog/brands').then((r) => r.json()), fetch('/api/catalog/sources').then((r) => r.json()), fetch('/api/catalog/health').then((r) => r.json())])
      .then(([brands, sources, health]) => setCatalogData({ brands: brands.brands || [], sources: sources.sources || [], counts: health.counts || null })).catch(() => {})
  }, [])
  useEffect(() => {
    const openReminder = () => setModal('reminder')
    document.addEventListener('lembracar:new-reminder', openReminder)
    return () => document.removeEventListener('lembracar:new-reminder', openReminder)
  }, [])

  const monthExpenses = useMemo(() => expenses.filter((item) => String(item.date || '').slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((sum, item) => sum + Number(item.amount || 0), 0), [expenses])
  const completedMaintenance = maintenance.filter((item) => item.status === 'Concluída').length
  const awaitingMaintenance = maintenance.filter((item) => item.status === 'Aguardando resposta').length

  const movePage = (next) => { setPage(next); setFabOpen(false); setModal('') }
  const completeOnboarding = () => {
    const cleanPlate = ''
    const vehicleDraft = { brand: draft.make.trim(), model: draft.model.trim(), version: draft.version.trim(), year: draft.year, city: draft.city.trim(), plate: cleanPlate }
    setVehicle(vehicleDraft)
    setProfile({ name: draft.name.trim() })
    movePage('inicio')
    setToast('Veículo cadastrado. Consulte a cobertura disponível no catálogo.')
  }
  const saveMileage = (value) => {
    const nextValue = Math.max(0, Number(value))
    setMileage(nextValue)
    setToast('Quilometragem atualizada')
  }
  const submitExpense = (data) => {
    setExpenses((old) => [{ ...data, id: crypto.randomUUID(), date: data.date || new Date().toISOString() }, ...old])
    setMileage((current) => mileageFromRecord(current, data.mileage))
    setModal('')
    setToast('Gasto registrado')
  }
  const removeExpense = (id) => {
    setExpenses((old) => old.filter((item) => item.id !== id))
    setToast('Gasto removido do extrato')
  }
  const submitMaintenance = (title, amount, recordedMileage = mileage, recordedDate, hasInvoice = false) => {
    const serviceMileage = Math.max(0, Number(recordedMileage ?? mileage))
    const completedAt = recordedDate ? new Date(`${recordedDate}T12:00:00`).toISOString() : new Date().toISOString()
    setMileage((current) => mileageFromRecord(current, serviceMileage))
    const id = crypto.randomUUID()
    setMaintenance((old) => [{ id, title, detail: `${serviceMileage.toLocaleString('pt-BR')} km · ${new Date(completedAt).toLocaleDateString('pt-BR')}${hasInvoice ? ' · Nota fiscal' : ''}`, status: 'Concluída', km: serviceMileage, amount: Number(amount || 0), hasInvoice, completedAt }, ...old])
    if (amount) setExpenses((old) => [{ id: crypto.randomUUID(), type: 'Manutenção', maintenanceId: id, title, amount: Number(amount), date: completedAt }, ...old])
    setModal('')
    setToast('Manutenção adicionada ao histórico')
  }
  const completeExistingMaintenance = (item, amount, recordedMileage = mileage, recordedDate) => {
    if (!maintenance.includes(item) || item.status === 'Concluída') return
    const id = item.id ?? crypto.randomUUID()
    const completedAt = recordedDate ? new Date(`${recordedDate}T12:00:00`).toISOString() : new Date().toISOString()
    const serviceMileage = Math.max(0, Number(recordedMileage ?? mileage))
    setMileage((current) => mileageFromRecord(current, serviceMileage))
    setMaintenance((old) => old.map((entry) => entry === item ? { ...entry, id, status: 'Concluída', km: serviceMileage, detail: `${serviceMileage.toLocaleString('pt-BR')} km · ${new Date(completedAt).toLocaleDateString('pt-BR')}`, completedAt, amount: Number(amount || entry.amount || 0) } : entry))
    if (amount) setExpenses((old) => [{ id: crypto.randomUUID(), type: 'Manutenção', maintenanceId: id, title: item.title, amount: Number(amount), date: completedAt }, ...old])
    setModal('')
    setToast('Serviço marcado como concluído')
  }
  const submitReminder = (title, date) => {
    setReminders((old) => [{ title, date, id: crypto.randomUUID() }, ...old])
    setModal('')
    setToast('Lembrete criado')
  }
  const submitChat = (question = query) => {
    if (!question.trim()) return
    const prompt = question.trim()
    setConversation((old) => [...old, { role: 'user', text: prompt }])
    setQuery('')
    setTimeout(() => setConversation((old) => [...old, { role: 'assistant', text: answerFor(prompt, mileage, monthExpenses, vehicle, maintenance) }]), 350)
  }
  const searchCatalog = async (value = catalogQuery) => {
    setCatalogQuery(value)
    const request = ++catalogRequest.current
    setCatalogResults([])
    if (!value.trim()) { setCatalogSearchStatus('idle'); return }
    setCatalogSearchStatus('loading')
    try {
      const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(value)}`)
      const data = await response.json()
      if (!response.ok) throw new Error('Busca indisponível')
      if (request === catalogRequest.current) {
        setCatalogResults(data.vehicles || [])
        setCatalogSearchStatus('done')
      }
    } catch {
      if (request === catalogRequest.current) setCatalogSearchStatus('error')
    }
  }
  const contributeSource = async (data) => {
    try {
      const response = await fetch('/api/catalog/contributions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!response.ok) throw new Error('invalid')
      setToast('Fonte enviada para revisão do catálogo')
      return true
    } catch { setToast('Não foi possível registrar. Confira os dados e tente novamente.'); return false }
  }

  return (
    <main className={`app-shell ${page === 'onboarding' ? 'onboarding-shell' : ''}`}>
      {!pageIsReady ? <div className="app-loading" role="status">Carregando seus dados…</div> : !profile || !vehicle ? (
        <Onboarding step={onStep} setStep={setOnStep} draft={draft} setDraft={setDraft} onFinish={completeOnboarding} onToast={setToast} />
      ) : (
        <>
          <DesktopSidebar page={page} profile={profile} vehicle={vehicle} onNavigate={movePage} onProfile={() => setModal('profile')} onVehicle={() => setModal('vehicle')} />
          <div className="app-main">
            <Header page={page} vehicle={vehicle} profile={profile} onProfile={() => setModal('profile')} onReminders={() => setModal('notifications')} reminderCount={reminders.length} />
            <section className="screen-content" key={page}>
              {page === 'inicio' && <HomePage vehicle={vehicle} profile={profile} mileage={mileage} maintenance={maintenance} completedMaintenance={completedMaintenance} awaitingMaintenance={awaitingMaintenance} onMileageSave={saveMileage} onOpen={movePage} reminders={reminders} />}
              {page === 'manutencoes' && <MaintenancePage maintenance={maintenance} onComplete={(item) => { setServiceTitleDraft(item); setModal('complete-maintenance') }} onReminder={() => setModal('reminder')} onManual={() => { setServiceTitleDraft({ title: '', km: mileage }); setModal('maintenance') }} vehicle={vehicle} />}
              {page === 'gastos' && <ExpensesPage expenses={expenses} total={monthExpenses} onAdd={() => setModal('expense')} onRemove={removeExpense} />}
              {page === 'copiloto' && <CopilotPage vehicle={vehicle} profile={profile} mileage={mileage} conversation={conversation} query={query} setQuery={setQuery} onSubmit={submitChat} onSuggestion={submitChat} />}
              {page === 'historico' && <HistoryPage maintenance={maintenance} expenses={expenses} reminders={reminders} onRegister={() => { setServiceTitleDraft({ title: '', km: mileage }); setModal('maintenance') }} />}
              {page === 'catalogo' && <CatalogPage data={catalogData} query={catalogQuery} results={catalogResults} searchStatus={catalogSearchStatus} onSearch={searchCatalog} onContribute={contributeSource} />}
            </section>
            {fabOpen && <div className="fab-menu">
              <button onClick={() => { setFabOpen(false); setModal('reminder') }}>Criar novo lembrete <CalendarDays size={17} /></button>
              <button onClick={() => { setFabOpen(false); setServiceTitleDraft({ title: '', km: mileage }); setModal('maintenance') }}>Registrar manutenção feita <Check size={17} /></button>
              <button onClick={() => { setFabOpen(false); setModal('expense') }}>Registrar gasto <Wallet size={17} /></button>
            </div>}
            {page !== 'copiloto' && <button className={`fab ${fabOpen ? 'fab-open' : ''}`} aria-label={fabOpen ? 'Fechar ações' : 'Adicionar'} onClick={() => setFabOpen(!fabOpen)}>{fabOpen ? <X size={25} /> : <Plus size={26} />}</button>}
            <BottomNav page={page} onNavigate={movePage} />
          </div>
        </>
      )}
      {modal && <Modal key={modal} name={modal} onEditVehicle={() => setModal('vehicle')} close={() => setModal('')} onExpense={submitExpense} onMaintenance={submitMaintenance} onCompleteMaintenance={completeExistingMaintenance} onReminder={submitReminder} onToast={setToast} profile={profile} setProfile={setProfile} mileage={mileage} setMileage={setMileage} vehicle={vehicle} setVehicle={setVehicle} reminders={reminders} initialTitle={modal === 'complete-maintenance' ? serviceTitleDraft.title : ''} initialMileage={modal === 'complete-maintenance' ? serviceTitleDraft.km ?? mileage : mileage} maintenanceItem={serviceTitleDraft} />}
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
    </main>
  )
}

function answerFor(question, mileage, spend, vehicle, maintenance) {
  const lower = question.toLowerCase()
  if (lower.includes('gasto') || lower.includes('gaste')) return `Neste mês você registrou ${money(spend)} em gastos do seu carro. Anote cada abastecimento e manutenção para acompanhar sua média ao longo do tempo.`
  if (lower.includes('óleo')) {
    const latest = maintenance.filter((item) => item.status === 'Concluída' && /óleo/i.test(item.title)).sort((a, b) => (Date.parse(b.completedAt) || 0) - (Date.parse(a.completedAt) || 0))[0]
    return latest ? `Seu último registro de serviço relacionado a óleo é “${latest.title}” em ${Number(latest.km || 0).toLocaleString('pt-BR')} km. O próximo intervalo depende do manual da versão ${vehicle?.version || 'do veículo'}, que ainda precisa ser confirmado.` : `Não há troca de óleo registrada. O intervalo depende da versão e da orientação do fabricante; o catálogo ainda não tem uma fonte verificada para este veículo. Quilometragem informada: ${Number(mileage).toLocaleString('pt-BR')} km.`
  }
  if (lower.includes('vencid') || lower.includes('atras')) return `Há ${maintenance.filter((item) => item.status === 'Atrasada').length} item(ns) marcados como atrasados nos seus registros. Isso não é uma avaliação técnica: confirme o plano no manual do veículo.`
  if (lower.includes('carro')) return `${vehicle?.brand || 'Veículo'} ${vehicle?.model || ''} ${vehicle?.year || ''} · ${vehicle?.version || 'versão não informada'}. Quilometragem: ${Number(mileage).toLocaleString('pt-BR')} km. Posso organizar seus registros e gastos; recomendações específicas dependem de fonte confirmada.`
  return 'Posso ajudar a organizar seus registros e gastos. Para especificações, defeitos conhecidos ou elegibilidade em concessionária, confira o manual e as fontes oficiais da marca.'
}

function Header({ page, vehicle, profile, onProfile, onReminders, reminderCount = 0 }) {
  const pageNames = { inicio: profile?.name ? `Olá, ${profile.name}` : 'Início', manutencoes: 'Manutenções', gastos: 'Gastos', copiloto: 'Copiloto', historico: 'Histórico', catalogo: 'Catálogo técnico' }
  return (
    <header className="app-header">
      <div className="brand-row">
        <div className="brand-symbol">ℒ</div>
        <div className="brand-title-wrap"><strong>{pageNames[page]}</strong>{vehicle && <span>{vehicle.brand} {vehicle.model}</span>}</div>
        <div className="header-actions"><button className="icon-button notification-icon" aria-label={`Lembretes (${reminderCount})`} onClick={onReminders}><Bell size={18} />{reminderCount > 0 && <b>{reminderCount}</b>}</button><button className="avatar-button" onClick={onProfile} aria-label="Abrir perfil">{(profile?.name || vehicle?.model || 'P').slice(0, 1)}</button></div>
      </div>
    </header>
  )
}

function BottomNav({ page, onNavigate }) {
  return <nav className="bottom-nav" aria-label="Navegação principal">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'selected' : ''} onClick={() => onNavigate(id)}><Icon size={20} strokeWidth={page === id ? 2.5 : 1.8} /><span>{label}</span></button>)}</nav>
}

function DesktopSidebar({ page, profile, vehicle, onNavigate, onProfile, onVehicle }) {
  return <aside className="desktop-sidebar">
      <button className="sidebar-brand" aria-label="Ir para o início" onClick={() => onNavigate('inicio')}><span className="brand-symbol">ℒ</span></button>
    <div className="sidebar-label">MENU PRINCIPAL</div>
    <nav aria-label="Navegação para desktop">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => onNavigate(id)}><Icon size={19} /><span>{label}</span></button>)}</nav>
    <button className="sidebar-vehicle" onClick={onVehicle}><span className="sidebar-car"><Car size={20} /></span><div><b>{vehicle?.brand} {vehicle?.model}</b><small>{vehicle?.plate || 'Placa não informada'} · {vehicle?.year || 'ano'}</small></div><Pencil size={14} /></button>
    <button className="sidebar-profile" onClick={onProfile}><span className="avatar-button">{(profile?.name || 'P').slice(0, 1)}</span><span><b>{profile?.name || 'Meu perfil'}</b><small>Meu perfil</small></span><MoreHorizontal size={17} /></button>
  </aside>
}

function HomePage({ vehicle, profile, mileage, maintenance, completedMaintenance, awaitingMaintenance, onMileageSave, onOpen, reminders }) {
  const [editing, setEditing] = useState(false)
  const [mileageDraft, setMileageDraft] = useState(mileage)
  const remaining = awaitingMaintenance
  const shown = vehicle?.model || 'seu veículo'
  return <div className="home-stack">
    <section className="hero-card">
      <div className="hero-greeting">Meu veículo</div>
      <div className="hero-vehicle"><div className="car-tile"><Car size={29} /></div><div className="vehicle-name"><small>{vehicle?.brand || 'VEÍCULO'}</small><strong>{shown}</strong><small>{vehicle?.plate || 'Placa não informada'} · {vehicle?.year || 'Ano não informado'}</small></div></div>
      <button className="waiting-line" onClick={() => onOpen('manutencoes')}><Clock3 size={15} /><b>{remaining ? `${remaining} itens aguardam confirmação` : 'Consulte seus registros de manutenção'}</b><ChevronRight size={16} /></button>
      <div className="odometer-block"><strong>{Number(mileage).toLocaleString('pt-BR')} km</strong><span>no odômetro</span></div>
      {!editing && <button className="yellow-button update-mileage" onClick={() => { setMileageDraft(mileage); setEditing(true) }}>Atualizar quilometragem <Gauge size={16} /></button>}
      {editing && <form className="inline-mileage" onSubmit={(event) => { event.preventDefault(); onMileageSave(mileageDraft); setEditing(false) }}><input aria-label="Quilometragem atual" type="number" min="0" required value={mileageDraft} onChange={(event) => setMileageDraft(event.target.value)} /><span>km</span><button type="submit" aria-label="Salvar quilometragem"><Check size={17} /></button><button type="button" aria-label="Cancelar edição" onClick={() => setEditing(false)}><X size={17} /></button></form>}
    </section>
    <section className="surface-card quick-actions-card"><h2>Acesso rápido</h2><div className="quick-actions"><button onClick={() => onOpen('manutencoes')}><Wrench size={17} /><span>Manutenções</span><ChevronRight size={15} /></button><button onClick={() => onOpen('gastos')}><Wallet size={17} /><span>Gastos do veículo</span><ChevronRight size={15} /></button><button onClick={() => onOpen('catalogo')}><BookOpen size={17} /><span>Fontes oficiais</span><ChevronRight size={15} /></button></div></section>
    <section className="surface-card summary-card"><div className="card-heading"><div><h2>Resumo das manutenções</h2><p>Do seu {shown}</p></div><Wrench size={18} /></div><div className="summary-stats"><div className="stat-red"><b>{maintenance.filter((item) => item.status === 'Atrasada').length}</b><span>atrasadas</span></div><div className="stat-amber"><b>{maintenance.filter((item) => item.status === 'Em breve').length}</b><span>em breve</span></div><div className="stat-green"><b>{completedMaintenance}</b><span>registradas</span></div></div><button className="text-link" onClick={() => onOpen('manutencoes')}>Ver registros <ArrowRight size={15} /></button></section>
    {reminders.length > 0 && <section className="surface-card summary-card"><h2>Seus lembretes</h2>{reminders.map((item) => <p className="reminder-row" key={item.id}><CalendarDays size={16} />{item.title}</p>)}</section>}
  </div>
}

function MaintenancePage({ maintenance, onComplete, onReminder, onManual, vehicle }) {
  const [tab, setTab] = useState('manutencoes')
  const [filter, setFilter] = useState('todas')
  const countComplete = maintenance.filter((item) => item.status === 'Concluída').length
  const revisionItems = maintenance.filter((item) => item.title.toLowerCase().includes('revis'))
  const sourceList = tab === 'revisoes' ? revisionItems : maintenance
  const list = filter === 'atrasadas' ? sourceList.filter((item) => item.status === 'Atrasada') : filter === 'em breve' ? sourceList.filter((item) => item.status === 'Em breve') : filter === 'em dia' ? sourceList.filter((item) => item.status === 'Concluída') : sourceList
  return <div className="page-content maintenance-page">
    <div className="segment-control"><button className={tab === 'manutencoes' ? 'active' : ''} onClick={() => setTab('manutencoes')}>Manutenções <span>{maintenance.length}</span></button><button className={tab === 'revisoes' ? 'active' : ''} onClick={() => setTab('revisoes')}>Revisões</button></div>
    <section className="surface-card calibration-card"><div className="calibrate-header"><span className="round-icon"><CircleHelp size={18} /></span><div><strong>Plano por confirmar</strong><small>{vehicle?.brand || 'Marca'} {vehicle?.model || ''} · {vehicle?.year || 'ano não informado'}</small></div></div><p>Os intervalos variam por ano e motorização. Registre serviços já feitos e consulte os dados oficiais disponíveis.</p></section>
    <div className="filter-chips">{['Todas', 'Atrasadas', 'Em breve', 'Em dia'].map((value) => { const key = value.toLowerCase(); const scope = tab === 'revisoes' ? revisionItems : maintenance; const count = value === 'Todas' ? scope.length : value === 'Atrasadas' ? scope.filter((item) => item.status === 'Atrasada').length : value === 'Em breve' ? scope.filter((item) => item.status === 'Em breve').length : scope.filter((item) => item.status === 'Concluída').length; return <button key={value} className={filter === key ? 'chip-active' : ''} onClick={() => setFilter(key)}><ShieldCheck size={12} />{value === 'Todas' ? `Todas ${count}` : `${value} ${count}`}</button> })}</div>
    <div className="list-intro"><span>{maintenance.length} REGISTROS</span><span>{countComplete} concluídas · dados técnicos exigem fonte específica</span></div>
    {list.length ? <div className="maintenance-list">{list.map((item, i) => { const Icon = typeof item.icon === 'function' ? item.icon : Wrench; const Row = item.status === 'Concluída' ? 'div' : 'button'; return <Row className={`maintenance-row ${item.status === 'Concluída' ? 'row-complete' : ''}`} key={`${item.title}-${i}`} onClick={Row === 'button' ? () => onComplete(item) : undefined}><span className="maintenance-icon"><Icon size={17} /></span><span className="maintenance-copy"><b>{item.title}</b><small>{item.detail}</small></span><span className="maintenance-status">{item.status}{Row === 'button' && <ChevronRight size={15} />}</span></Row> })}</div> : <section className="surface-card revision-empty"><Wrench size={19} /><b>{tab === 'revisoes' ? 'Nenhuma revisão registrada' : 'Nenhum serviço registrado'}</b><span>Registre um serviço feito ou consulte as fontes disponíveis no Catálogo.</span><button className="yellow-button" onClick={onManual}>Registrar serviço <Plus size={16} /></button></section>}
    <section className="surface-card next-review"><div className="card-heading"><div><h2>Próxima revisão</h2><p>Sem agenda técnica confirmada</p></div><CalendarDays size={18} /></div><p>Cadastre um lembrete com base no manual do seu veículo ou na orientação da concessionária.</p><button className="yellow-button" onClick={onReminder}>Criar lembrete <ArrowRight size={16} /></button></section>
  </div>
}

function ExpensesPage({ expenses, total, onAdd, onRemove }) {
  const [view, setView] = useState('extrato')
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthExpenses = expenses.filter((item) => String(item.date || '').slice(0, 7) === currentMonth)
  const monthTotal = monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const buckets = monthExpenses.reduce((acc, item) => { acc[item.type] = (acc[item.type] || 0) + Number(item.amount); return acc }, {})
  return <div className="page-content expenses-page">
    <div className="segment-control"><button className={view === 'extrato' ? 'active' : ''} onClick={() => setView('extrato')}><Menu size={14} />Extrato</button><button className={view === 'graficos' ? 'active' : ''} onClick={() => setView('graficos')}><SlidersHorizontal size={14} />Gráficos</button></div>
    <section className="surface-card month-total"><small>ESTE MÊS</small><strong>{money(monthTotal)}</strong><p>Valores dos registros neste mês.</p><div className="month-stat"><div><b>{monthExpenses.length}</b><span>LANÇAMENTOS</span></div><div><b>{monthExpenses.length ? money(monthTotal / monthExpenses.length) : '—'}</b><span>TICKET MÉDIO</span></div></div></section>
    {view === 'graficos' ? <section className="surface-card chart-card"><h2>Seus gastos por categoria</h2>{['Abastecimento', 'Manutenção', 'Gasto avulso', 'Conta fixa'].map((type) => <div className="chart-row" key={type}><span>{type}</span><div className="chart-track"><i style={{ width: `${monthTotal ? (buckets[type] || 0) / monthTotal * 100 : 0}%` }} /></div><b>{money(buckets[type] || 0)}</b></div>)}<p className="muted-note">Os gráficos consideram apenas os lançamentos do mês atual.</p></section> : expenses.length ? <section className="surface-card expenses-list"><h2>Seu extrato</h2>{expenses.map((item) => <div className="expense-row" key={item.id}><span className="round-icon"><Wallet size={17} /></span><span><b>{item.title}</b><small>{item.type} · {displayDate(item.date)}</small></span><strong>{money(item.amount)}</strong><button className="remove-expense" title={`Remover ${item.title}`} aria-label={`Remover ${item.title}`} onClick={() => onRemove(item.id)}><X size={15} /></button></div>)}</section> : <section className="surface-card empty-expenses"><div className="empty-wallet"><Wallet size={27} /></div><h2>Seus gastos, num lugar só.</h2><p>Registre abastecimentos, despesas e serviços para acompanhar os valores por mês.</p><button className="yellow-button" onClick={onAdd}>Registrar primeiro gasto <Plus size={16} /></button></section>}
  </div>
}

function CopilotPage({ vehicle, profile, mileage, conversation, query, setQuery, onSubmit, onSuggestion }) {
  const suggestions = ['O que está vencido?', 'Qual é a quilometragem do meu carro?', 'Quanto gastei este mês?', 'Quando registrei a última troca de óleo?']
  return <div className="page-content copilot-page">
    <div className="copilot-intro"><div className="copilot-avatar">ℒ</div><h1>Olá{profile?.name ? `, ${profile.name}` : ''}. Vamos organizar os dados do seu {vehicle?.model || 'veículo'}.</h1><p>{Number(mileage).toLocaleString('pt-BR')} km informados. Pergunte sobre seus registros, gastos e fontes de manutenção disponíveis.</p></div>
    {conversation.length === 0 ? <><h2 className="section-title">Sugestões para começar</h2><div className="suggestion-grid">{suggestions.map((text, i) => <button key={text} className="suggestion-card" onClick={() => onSuggestion(text)}><span className="suggestion-dot" aria-hidden="true">{['⚠', '◎', '↗', '⌕'][i]}</span><b>{text}</b><ChevronRight size={14} /></button>)}</div></> : <div className="conversation-list">{conversation.map((message, i) => <div key={i} className={`chat-bubble ${message.role}`}>{message.text}</div>)}</div>}
    <section className="recent-conversations"><h2>Conversa atual</h2><div className="recent-empty"><MessageCircle size={23} /><span>{conversation.length ? `${conversation.filter((message) => message.role === 'user').length} pergunta(s) nesta conversa` : 'Envie uma pergunta para começar.'}</span></div></section>
    <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); onSubmit() }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pergunte ao Copiloto..." aria-label="Mensagem para o Copiloto" /><button aria-label="Enviar mensagem"><ArrowRight size={19} /></button></form><small className="copilot-footnote">O Copiloto pode errar. Confirme com um mecânico.</small>
  </div>
}

function HistoryPage({ maintenance, expenses, reminders, onRegister }) {
  const hasRecords = maintenance.some((item) => item.status === 'Concluída') || expenses.length > 0 || reminders.length > 0
  return <div className="page-content history-page">
    {hasRecords && <section className="surface-card report-card"><div className="report-kicker">HISTÓRICO LOCAL</div><h2>Registros do seu veículo</h2><p>Consulte os serviços, gastos e lembretes que você anotou.</p><div className="report-preview"><div className="report-brand">ℒ </div><b>Histórico de manutenção</b><span>Dados registrados neste dispositivo</span><hr /><div>{maintenance.filter((item) => item.status === 'Concluída').length} MANUTENÇÕES　 ·　 {expenses.length} GASTOS</div><p>Este resumo não substitui notas fiscais ou documento técnico.</p></div><button className="outline-button" onClick={onRegister}>Registrar manutenção <Plus size={16} /></button></section>}
    <section className="surface-card history-start"><div className="history-progress-heading"><h2>Seu histórico</h2><b>{maintenance.filter((item) => item.status === 'Concluída').length} serviços</b></div><p>Registros locais de manutenção, gastos e lembretes.</p></section>
    <h2 className="section-title timeline-heading">Linha do tempo <small>{maintenance.filter((item) => item.status === 'Concluída').length} manutenções</small></h2>
    <section className="surface-card timeline-card">
      {!hasRecords && <p>Nenhum registro ainda.</p>}
      {historyEntries(maintenance, expenses, reminders).map((item) => {
        const Icon = item.kind === 'Serviço' ? Check : item.kind === 'Lembrete' ? CalendarDays : Wallet
        return <div className="timeline-item" key={item.key}>
          <span className="timeline-pin"><Icon size={12} /></span>
          <div><strong>{item.title}</strong><small>{item.kind} · {displayDate(item.date)}{item.km != null ? ` · ${Number(item.km).toLocaleString('pt-BR')} km` : ''}</small></div>
        </div>
      })}
    </section>
  </div>
}

function CatalogPage({ data, query, results, searchStatus, onSearch, onContribute }) {
  const counts = data.counts || {}
  const [showFipe, setShowFipe] = useState(false)
  return <div className="page-content catalog-page">
    <section className="surface-card catalog-intro"><span className="catalog-kicker">BASE AUTOMOTIVA BRASIL</span><h1>Catálogo técnico</h1><p>Pesquise veículos com cobertura revisada e ajude a completar os dados. Planos de manutenção e condições de garantia só aparecem quando associados a uma fonte e versão específicas.</p></section>
    <section className="surface-card"><button className="yellow-button" onClick={() => setShowFipe(!showFipe)} aria-expanded={showFipe}>{showFipe ? 'Fechar consulta FIPE' : 'Consultar Tabela FIPE'}</button>{showFipe && <FipeLookup />}</section>
    <section className="surface-card catalog-coverage"><h2>Estado da base</h2><div className="catalog-count-grid"><div><b>{counts.brands ?? data.brands.length}</b><span>marcas na lista inicial</span></div><div><b>{counts.models ?? 0}</b><span>modelos verificados</span></div><div><b>{counts.manuals ?? 0}</b><span>manuais conferidos</span></div><div><b>{counts.schedules ?? 0}</b><span>planos verificados</span></div></div><p className="muted-note">Marcas com cobertura “lista inicial” ainda não têm dados de modelo confirmados. Não usamos intervalos genéricos para prever manutenção.</p></section>
    <section className="surface-card catalog-search"><h2>Buscar modelo com dados revisados</h2><form onSubmit={(event) => { event.preventDefault(); onSearch() }}><input aria-label="Buscar marca ou modelo" value={query} onChange={(event) => onSearch(event.target.value)} placeholder="Ex.: Toyota Corolla" /><button className="yellow-button">Buscar <Search size={16} /></button></form>{searchStatus === 'loading' && <p role="status">Buscando modelos…</p>}{searchStatus === 'error' && <p role="alert">Não foi possível buscar no catálogo. Tente novamente.</p>}{searchStatus === 'done' && results.length === 0 && <p className="muted-note">Nenhum modelo revisado encontrado para “{query}”. Envie uma fonte pública para ampliar a cobertura.</p>}{results.length > 0 && <div className="catalog-results">{results.map((item) => <div key={item.id}><Car size={18} /><span><b>{item.brand} {item.model}</b><small>{item.generation || 'Versão não especificada'} · anos {item.model_year_from || '—'}–{item.model_year_to || 'atual'}</small></span><i>Dados revisados</i></div>)}</div>}</section>
    <section className="surface-card catalog-brands"><h2>30 marcas na cobertura inicial</h2><div className="brand-coverage-list">{data.brands.map((brand) => <div key={brand.id}><span><b>{brand.name}</b><small>{brand.verified_models ? `${brand.verified_models} modelo(s) revisado(s)` : 'Aguardando dados por modelo'}</small></span><i>{brand.coverage_status === 'verified' ? 'Verificada' : 'Em estruturação'}</i></div>)}</div></section>
    <section className="surface-card catalog-sources"><h2>Fontes registradas</h2>{data.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.id}><span><b>{source.organization}</b><small>{source.title}</small></span><ArrowUpRight size={15} /></a>)}<p className="muted-note">Dados de recall podem ser consultados também pelo serviço oficial da Senatran usando placa ou chassi.</p><a href="https://www.gov.br/pt-br/servicos/realizar-consulta-sobre-recall-de-veiculos?id=10560&origem=servico" target="_blank" rel="noreferrer"><span><b>Senatran</b><small>Consultar recall deste veículo</small></span><ArrowUpRight size={15} /></a></section>
    <form className="surface-card catalog-contribution" onSubmit={async (event) => { event.preventDefault(); const target = event.currentTarget; const form = new FormData(target); const submit = target.querySelector('button'); submit.disabled = true; const saved = await onContribute({ kind: 'document_link', contributorLabel: String(form.get('contributor') || ''), payload: { brand: String(form.get('brand') || ''), title: String(form.get('title') || ''), url: String(form.get('url') || '') } }); if (saved) target.reset(); submit.disabled = false }}><h2>Contribuir com uma fonte</h2><p>Envie um link público para manual, revisão, garantia, boletim ou recall. A informação fica pendente até ser revisada.</p><label className="form-field">Marca<input name="brand" placeholder="Ex.: Toyota" required /></label><label className="form-field">Título da fonte<input name="title" placeholder="Ex.: Manual do proprietário 2025" required /></label><label className="form-field">Link público<input name="url" type="url" placeholder="https://..." required /></label><label className="form-field">Seu nome (opcional)<input name="contributor" /></label><button className="yellow-button">Enviar para revisão <ArrowRight size={16} /></button></form>
  </div>
}

function Onboarding({ step, setStep, draft, setDraft, onFinish, onToast }) {
  const [showFipe, setShowFipe] = useState(false)
  const set = (key, value) => setDraft((old) => ({ ...old, [key]: value }))
  const advance = () => {
    if (step === 1) {
      if (!draft.make.trim() || !draft.model.trim() || !/^[0-9]{4}$/.test(draft.year) || Number(draft.year) < 1950 || Number(draft.year) > new Date().getFullYear() + 1) { onToast('Informe marca, modelo e ano para continuar'); return }
    }
    if (step === 2) { setStep(step + 1); return }
    if (step === 4) { onFinish(); return }
    setStep(step + 1)
  }
  return <div className="onboarding">
    <div className="onboarding-top"><span className="phone-notch" />{step > 1 && <button onClick={() => setStep(step - 1)} aria-label="Voltar"><ArrowLeft size={21} /></button>}<div className="onboarding-top-brand">{step > 2 ? 'Seu veículo' : ''}</div></div>
    {step === 1 && <div className="onboarding-content plate-step"><small className="eyebrow">CADASTRO DO VEÍCULO</small><h1>Qual veículo vamos acompanhar?</h1><p>O catálogo cruza os dados técnicos por modelo, ano e motorização. Você pode preencher os dados ou consultar a Tabela FIPE.</p><button className="link-button" type="button" aria-expanded={showFipe} onClick={() => setShowFipe(!showFipe)}>{showFipe ? 'Fechar consulta FIPE' : 'Consultar Tabela FIPE'}</button>{showFipe && <FipeLookup onUse={(item) => { setDraft((old) => ({ ...old, make: item.brand, model: item.model, version: '', year: String(item.modelYear) })); setShowFipe(false) }} />}<label className="form-field">Marca<input autoFocus value={draft.make} onChange={(event) => set('make', event.target.value)} placeholder="Ex.: Toyota" required /></label><label className="form-field">Modelo<input value={draft.model} onChange={(event) => set('model', event.target.value)} placeholder="Ex.: Corolla" required /></label><label className="form-field">Versão / motor <span>(opcional)</span><input value={draft.version} onChange={(event) => set('version', event.target.value)} placeholder="Ex.: 2.0 Flex" /></label><label className="form-field">Ano<input type="number" min="1950" max={new Date().getFullYear() + 1} value={draft.year} onChange={(event) => set('year', event.target.value)} placeholder="2022" required /></label><button className="yellow-button onboarding-cta" disabled={!draft.make.trim() || !draft.model.trim() || !draft.year} onClick={advance}>Continuar <ArrowRight size={16} /></button></div>}
    {step === 2 && <div className="onboarding-content found-step"><small className="eyebrow">DADOS INFORMADOS</small><Car size={42} /><h1>{draft.make} {draft.model}</h1><div className="fipe-card"><span>VERSÃO E ANO</span><b>{draft.version || 'Versão não informada'}</b><div><span>ANO<br /><b>{draft.year}</b></span><span>COBERTURA<br /><b>A confirmar</b></span></div></div><p>Cadastro baseado nos dados que você informou. O plano depende de documentação específica disponível no catálogo.</p><button className="yellow-button onboarding-cta" onClick={advance}>Confirmar veículo <Check size={17} /></button><button className="link-button" onClick={() => setStep(1)}>Editar dados</button></div>}
    {step === 3 && <div className="onboarding-content city-step"><small className="eyebrow">ÚLTIMOS AJUSTES</small><h1>Em que cidade você mora?</h1><p>Opcional. Pode ajudar a organizar serviços locais futuramente.</p><label className="form-field">Cidade <span>(opcional)</span><input autoFocus value={draft.city} onChange={(event) => set('city', event.target.value)} /></label><label className="form-field">Seu nome <span>(opcional)</span><input value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="Como podemos chamar você?" /></label><button className="yellow-button onboarding-cta" onClick={advance}>Continuar <ArrowRight size={16} /></button></div>}
    {step === 4 && <div className="onboarding-content account-step"><div className="brand-mark-large">ℒ </div><h1>Seu veículo<br /><mark>organizado</mark></h1><p>Cadastre serviços e gastos, consulte a cobertura do catálogo e acompanhe seus lembretes.</p><div className="app-preview"><div><Car size={17} /> {draft.make} {draft.model} · {draft.year}</div><strong>{draft.version || 'Versão a confirmar'}</strong><span>Dados técnicos: consulte as fontes disponíveis.</span><span className="yellow-bar" /></div><button className="yellow-button onboarding-cta" onClick={onFinish}>Começar <ArrowRight size={17} /></button></div>}
    <div className="onboarding-progress"><span style={{ width: `${Math.max(8, step / 4 * 100)}%` }} /></div>
  </div>
}

function Modal({ name, close, onEditVehicle, onExpense, onMaintenance, onCompleteMaintenance, onReminder, onToast, profile, setProfile, mileage, setMileage, vehicle, setVehicle, reminders = [], initialTitle = '', initialMileage = mileage, maintenanceItem = {} }) {
  const [title, setTitle] = useState(initialTitle)
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('Abastecimento')
  const [date, setDate] = useState('')
  const [mileageDraft, setMileageDraft] = useState(initialMileage)
  const [liters, setLiters] = useState('')
  const [fuelMileage, setFuelMileage] = useState(mileage)
  const [nameDraft, setNameDraft] = useState(profile?.name || '')
  const [checked, setChecked] = useState({})
  const submitExpense = (event) => { event.preventDefault(); if (!title.trim() || !amount) return; onExpense({ title: title.trim(), amount: Number(amount), type, ...(type === 'Abastecimento' ? { liters: liters ? Number(liters) : null, mileage: fuelMileage ? Number(fuelMileage) : null } : {}), date: date || new Date().toISOString() }) }
  const submitMaintenance = (event) => { event.preventDefault(); if (!title.trim()) return; onMaintenance(title.trim(), amount, mileageDraft, date, checked.invoice || false) }
  const submitReminder = (event) => { event.preventDefault(); if (!title.trim()) return; onReminder(title.trim(), date) }
  useEffect(() => {
    const dismiss = (event) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [close])

  const modalTitles = { expense: 'Registrar gasto', maintenance: 'Registrar manutenção', 'complete-maintenance': 'Concluir serviço', reminder: 'Criar novo lembrete', profile: 'Seu perfil', vehicle: 'Editar veículo', notifications: 'Avisos e lembretes' }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="modal-handle" /><div className="modal-heading"><div><h2 id="dialog-title">{modalTitles[name]}</h2><p>{vehicle?.brand || 'Veículo'} {vehicle?.model || ''} · {vehicle?.year || 'ano não informado'}</p></div><button className="close-modal" onClick={close} aria-label="Fechar"><X size={19} /></button></div>
    {name === 'expense' && <form onSubmit={submitExpense}><label className="form-field">Tipo do gasto<select value={type} onChange={(e) => setType(e.target.value)}>{['Abastecimento', 'Manutenção', 'Gasto avulso', 'Conta fixa'].map((x) => <option key={x}>{x}</option>)}</select></label><label className="form-field">Descrição<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'Abastecimento' ? 'Gasolina, etanol…' : 'Ex.: troca de óleo'} required /></label><label className="form-field">Valor<input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 0,00" required /></label><label className="form-field">Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>{type === 'Abastecimento' && <><label className="form-field">Litros <span>(opcional)</span><input type="number" min="0" step="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="Ex.: 38" /></label><label className="form-field">Quilometragem <span>(opcional)</span><input type="number" min="0" value={fuelMileage} onChange={(e) => setFuelMileage(e.target.value)} /></label></>}<button className="yellow-button modal-submit">Salvar gasto <Check size={17} /></button></form>}
    {name === 'maintenance' && <form onSubmit={submitMaintenance}><label className="form-field">O que foi feito?<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: troca de óleo" required /></label><label className="form-field">Quilometragem<input type="number" min="0" value={mileageDraft} onChange={(e) => setMileageDraft(Number(e.target.value))} /></label><label className="form-field">Valor gasto <span>(opcional)</span><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 0,00" /></label><label className="form-field">Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label className="check-option"><input type="checkbox" checked={checked.invoice || false} onChange={(e) => setChecked((old) => ({ ...old, invoice: e.target.checked }))} /> Tenho nota fiscal do serviço</label><button className="yellow-button modal-submit">Registrar manutenção <Check size={17} /></button></form>}
    {name === 'complete-maintenance' && <form onSubmit={(event) => { event.preventDefault(); onCompleteMaintenance(maintenanceItem, amount, mileageDraft, date) }}><label className="form-field">Serviço<input value={title} readOnly required /></label><label className="form-field">Quilometragem<input type="number" min="0" value={mileageDraft} onChange={(e) => setMileageDraft(Number(e.target.value))} /></label><label className="form-field">Valor gasto <span>(opcional)</span><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><label className="form-field">Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><button className="yellow-button modal-submit">Marcar como concluído <Check size={17} /></button></form>}
    {name === 'reminder' && <form onSubmit={submitReminder}><label className="form-field">O que lembrar?<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: revisão do carro" required /></label><label className="form-field">Quando?<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><p className="muted-note">O lembrete fica salvo no painel; avisos automáticos no celular ainda não estão conectados.</p><button className="yellow-button modal-submit">Criar lembrete <CalendarDays size={17} /></button></form>}
    {name === 'profile' && <form onSubmit={(e) => { e.preventDefault(); setProfile((old) => ({ ...old, name: nameDraft.trim() })); close(); onToast('Perfil atualizado') }}><label className="form-field">Seu nome<input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} /></label><label className="form-field">Seu veículo<input readOnly value={`${vehicle?.brand || ''} ${vehicle?.model || ''} ${vehicle?.version || ''} · ${vehicle?.year || ''}`.trim()} /></label><button className="yellow-button modal-submit">Salvar perfil <Check size={17} /></button><button type="button" className="link-button" onClick={onEditVehicle}>Editar veículo</button></form>}
    {name === 'vehicle' && <form onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; setVehicle((old) => ({ ...old, brand: form.elements.namedItem('brand').value.trim(), model: form.elements.namedItem('model').value.trim(), version: form.elements.namedItem('version').value.trim(), year: form.elements.namedItem('year').value, plate: form.elements.namedItem('plate').value.toUpperCase() })); close(); onToast('Veículo atualizado') }}><label className="form-field">Marca<input name="brand" defaultValue={vehicle?.brand || ''} required /></label><label className="form-field">Modelo<input name="model" defaultValue={vehicle?.model || ''} required /></label><label className="form-field">Versão / motor<input name="version" defaultValue={vehicle?.version || ''} /></label><div className="form-row"><label className="form-field">Ano<input name="year" type="number" min="1950" max={new Date().getFullYear() + 1} defaultValue={vehicle?.year || ''} required /></label><label className="form-field">Placa<input name="plate" defaultValue={vehicle?.plate || ''} maxLength="7" /></label></div><button className="yellow-button modal-submit">Salvar veículo <Check size={17} /></button></form>}
    {name === 'notifications' && <div className="notification-list">{reminders.length ? reminders.map((item) => <div key={item.id}><span className="round-icon"><Bell size={17} /></span><span><b>{item.title}</b><small>{item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR') : 'Data não definida'} · lembrete salvo</small></span></div>) : <div><span className="round-icon"><Bell size={17} /></span><span><b>Nenhum lembrete cadastrado</b><small>Crie um lembrete para vê-lo aqui. Avisos automáticos não estão conectados.</small></span></div>}<button className="yellow-button modal-submit" type="button" onClick={() => { close(); document.dispatchEvent(new CustomEvent('lembracar:new-reminder')) }}>Criar lembrete <Plus size={16} /></button></div>}
  </section></div>
}

createRoot(document.getElementById('root')).render(<App />)
