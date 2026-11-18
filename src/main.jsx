import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, Car, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3,
  Droplet, FileText, Fuel, Gauge, History, Home, Info, KeyRound, Map, Menu,
  MessageCircle, Moon, MoreHorizontal, Pencil, Plus, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, Sun, Wallet, Wrench, X, Zap,
} from 'lucide-react'
import { calendarMonth, displayDate, historyEntries, mileageFromRecord, summarizeExpenses } from './records.js'
import { loadState, usePersistentState } from './usePersistentState.js'
import FipeLookup from './FipeLookup.jsx'
import { LanguageProvider, useLanguage } from './i18n.jsx'
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

function money(value) {
  const locale = document.documentElement.lang || 'pt-BR'
  return Number(value || 0).toLocaleString(locale, { style: 'currency', currency: 'BRL' })
}

function App() {
  const { t, locale, language } = useLanguage()
  const [profile, setProfile, profileReady] = usePersistentState('lembracar.profile', null)
  const [vehicle, setVehicle, vehicleReady] = usePersistentState('lembracar.vehicle', null)
  const [mileage, setMileage, mileageReady] = usePersistentState('lembracar.mileage', 0)
  const [maintenance, setMaintenance, maintenanceReady] = usePersistentState('lembracar.maintenance', initialMaintenance)
  const [expenses, setExpenses, expensesReady] = usePersistentState('lembracar.expenses', [])
  const [reminders, setReminders, remindersReady] = usePersistentState('lembracar.reminders', [])
  const [dark, setDark, themeReady] = usePersistentState('lembracar.dark', false)
  const [page, setPage] = useState(() => localStorage.getItem('lembracar.page') || (loadState('lembracar.vehicle', null) ? 'inicio' : 'onboarding'))
  const pageIsReady = profileReady && vehicleReady && mileageReady && maintenanceReady && expensesReady && remindersReady && themeReady
  const [fabOpen, setFabOpen] = useState(false)
  const [modal, setModal] = useState('')
  const [serviceTitleDraft, setServiceTitleDraft] = useState({ title: '', km: 0 })
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [conversation, setConversation] = useState([])
  const [onStep, setOnStep] = useState(1)
  const [draft, setDraft] = useState({ make: '', model: '', version: '', year: '', city: '', name: '' })

  useEffect(() => {
    if (!pageIsReady) return
    if (!profile || !vehicle) setPage('onboarding')
    else if (page === 'onboarding') setPage('inicio')
  }, [pageIsReady, profile, vehicle, page])
  useEffect(() => { localStorage.setItem('lembracar.page', page) }, [page])
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    const openReminder = () => setModal('reminder')
    document.addEventListener('lembracar:new-reminder', openReminder)
    return () => document.removeEventListener('lembracar:new-reminder', openReminder)
  }, [])

  const currentMonth = calendarMonth()
  const expenseSummary = useMemo(() => summarizeExpenses(expenses, currentMonth), [expenses, currentMonth])
  const completedMaintenance = maintenance.filter((item) => item.status === 'Concluída').length
  const awaitingMaintenance = maintenance.filter((item) => item.status === 'Aguardando resposta').length

  const movePage = (next) => { setPage(next); setFabOpen(false); setModal('') }
  const completeOnboarding = () => {
    const cleanPlate = ''
    const vehicleDraft = { brand: draft.make.trim(), model: draft.model.trim(), version: draft.version.trim(), year: draft.year, city: draft.city.trim(), plate: cleanPlate }
    setVehicle(vehicleDraft)
    setProfile({ name: draft.name.trim() })
    movePage('inicio')
    setToast(t('Veículo cadastrado. Consulte a cobertura disponível no catálogo.'))
  }
  const saveMileage = (value) => {
    const nextValue = Math.max(0, Number(value))
    setMileage(nextValue)
    setToast(t('Quilometragem atualizada'))
  }
  const submitExpense = (data) => {
    setExpenses((old) => [{ ...data, id: crypto.randomUUID(), date: data.date || new Date().toISOString() }, ...old])
    setMileage((current) => mileageFromRecord(current, data.mileage))
    setModal('')
    setToast(t('Gasto registrado'))
  }
  const removeExpense = (id) => {
    setExpenses((old) => old.filter((item) => item.id !== id))
    setToast(t('Gasto removido do extrato'))
  }
  const submitMaintenance = (title, amount, recordedMileage = mileage, recordedDate, hasInvoice = false) => {
    const serviceMileage = Math.max(0, Number(recordedMileage ?? mileage))
    const completedAt = recordedDate ? new Date(`${recordedDate}T12:00:00`).toISOString() : new Date().toISOString()
    setMileage((current) => mileageFromRecord(current, serviceMileage))
    const id = crypto.randomUUID()
    setMaintenance((old) => [{ id, title, detail: `${serviceMileage.toLocaleString(locale)} km · ${new Date(completedAt).toLocaleDateString(locale)}${hasInvoice ? ` · ${t('Nota fiscal')}` : ''}`, status: 'Concluída', km: serviceMileage, amount: Number(amount || 0), hasInvoice, completedAt }, ...old])
    if (amount) setExpenses((old) => [{ id: crypto.randomUUID(), type: 'Manutenção', maintenanceId: id, title, amount: Number(amount), date: completedAt }, ...old])
    setModal('')
    setToast(t('Manutenção adicionada ao histórico'))
  }
  const completeExistingMaintenance = (item, amount, recordedMileage = mileage, recordedDate) => {
    if (!maintenance.includes(item) || item.status === 'Concluída') return
    const id = item.id ?? crypto.randomUUID()
    const completedAt = recordedDate ? new Date(`${recordedDate}T12:00:00`).toISOString() : new Date().toISOString()
    const serviceMileage = Math.max(0, Number(recordedMileage ?? mileage))
    setMileage((current) => mileageFromRecord(current, serviceMileage))
    setMaintenance((old) => old.map((entry) => entry === item ? { ...entry, id, status: 'Concluída', km: serviceMileage, detail: `${serviceMileage.toLocaleString(locale)} km · ${new Date(completedAt).toLocaleDateString(locale)}`, completedAt, amount: Number(amount || entry.amount || 0) } : entry))
    if (amount) setExpenses((old) => [{ id: crypto.randomUUID(), type: 'Manutenção', maintenanceId: id, title: item.title, amount: Number(amount), date: completedAt }, ...old])
    setModal('')
    setToast(t('Serviço marcado como concluído'))
  }
  const submitReminder = (title, date) => {
    setReminders((old) => [{ title, date, id: crypto.randomUUID() }, ...old])
    setModal('')
    setToast(t('Lembrete criado'))
  }
  const submitChat = (question = query) => {
    const prompt = question.trim()
    if (!prompt) return
    const month = calendarMonth()
    const spend = month === currentMonth ? expenseSummary.total : summarizeExpenses(expenses, month).total
    const answer = answerFor(prompt, mileage, spend, vehicle, maintenance, language)
    setConversation((old) => [...old, { role: 'user', text: prompt }, { role: 'assistant', text: answer }])
    setQuery('')
  }

  return (
    <main className={`app-shell ${page === 'onboarding' ? 'onboarding-shell' : ''}`}>
      {!pageIsReady ? <div className="app-loading" role="status">{t('Carregando seus dados…')}</div> : !profile || !vehicle ? (
        <Onboarding step={onStep} setStep={setOnStep} draft={draft} setDraft={setDraft} onFinish={completeOnboarding} onToast={setToast} />
      ) : (
        <>
          <div className="app-main">
            <Header onNavigate={movePage} onVehicle={() => setModal('vehicle')} page={page} vehicle={vehicle} profile={profile} onProfile={() => setModal('profile')} onReminders={() => setModal('notifications')} reminderCount={reminders.length} dark={dark} onToggleTheme={() => setDark((current) => !current)} />
            <section className="screen-content" key={page}>
              {page === 'inicio' && <HomePage vehicle={vehicle} profile={profile} mileage={mileage} maintenance={maintenance} completedMaintenance={completedMaintenance} awaitingMaintenance={awaitingMaintenance} onMileageSave={saveMileage} onOpen={movePage} reminders={reminders} expenseSummary={expenseSummary} />}
              {page === 'manutencoes' && <MaintenancePage maintenance={maintenance} onComplete={(item) => { setServiceTitleDraft(item); setModal('complete-maintenance') }} onReminder={() => setModal('reminder')} onManual={() => { setServiceTitleDraft({ title: '', km: mileage }); setModal('maintenance') }} vehicle={vehicle} />}
              {page === 'gastos' && <ExpensesPage expenses={expenses} summary={expenseSummary} onAdd={() => setModal('expense')} onRemove={removeExpense} />}
              {page === 'copiloto' && <CopilotPage vehicle={vehicle} profile={profile} mileage={mileage} conversation={conversation} query={query} setQuery={setQuery} onSubmit={submitChat} onSuggestion={submitChat} />}
              {page === 'historico' && <HistoryPage maintenance={maintenance} expenses={expenses} reminders={reminders} onRegister={() => { setServiceTitleDraft({ title: '', km: mileage }); setModal('maintenance') }} />}
              {page === 'catalogo' && <CatalogPage />}
            </section>
            {fabOpen && <div className="fab-menu">
              <button onClick={() => { setFabOpen(false); setModal('reminder') }}>{t('Criar novo lembrete')} <CalendarDays size={17} /></button>
              <button onClick={() => { setFabOpen(false); setServiceTitleDraft({ title: '', km: mileage }); setModal('maintenance') }}>{t('Registrar manutenção feita')} <Check size={17} /></button>
              <button onClick={() => { setFabOpen(false); setModal('expense') }}>{t('Registrar gasto')} <Wallet size={17} /></button>
            </div>}
            {page !== 'copiloto' && <button className={`fab ${fabOpen ? 'fab-open' : ''}`} aria-label={fabOpen ? t('Fechar ações') : t('Adicionar')} onClick={() => setFabOpen(!fabOpen)}>{fabOpen ? <X size={25} /> : <Plus size={26} />}</button>}
          </div>
        </>
      )}
      {modal && <Modal key={modal} name={modal} onEditVehicle={() => setModal('vehicle')} close={() => setModal('')} onExpense={submitExpense} onMaintenance={submitMaintenance} onCompleteMaintenance={completeExistingMaintenance} onReminder={submitReminder} onToast={setToast} profile={profile} setProfile={setProfile} mileage={mileage} setMileage={setMileage} vehicle={vehicle} setVehicle={setVehicle} reminders={reminders} initialTitle={modal === 'complete-maintenance' ? serviceTitleDraft.title : ''} initialMileage={modal === 'complete-maintenance' ? serviceTitleDraft.km ?? mileage : mileage} maintenanceItem={serviceTitleDraft} />}
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
    </main>
  )
}

function answerFor(question, mileage, spend, vehicle, maintenance, language = 'pt') {
  const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const lower = normalize(question)
  if (lower.includes('gasto') || lower.includes('gaste') || lower.includes('spent') || lower.includes('expense')) return language === 'en' ? `You recorded ${money(spend)} in vehicle expenses this month. Log each fuel stop and service to track spending over time.` : language === 'es' ? `Este mes registraste ${money(spend)} en gastos del vehículo. Anota cada repostaje y servicio para controlar el gasto.` : `Neste mês você registrou ${money(spend)} em gastos do seu carro. Anote cada abastecimento e manutenção para acompanhar sua média ao longo do tempo.`
  if (lower.includes('oleo') || lower.includes('oil') || lower.includes('aceite')) {
    const latest = maintenance.reduce((found, item) => {
      if (item.status !== 'Concluída' || !/\boleo\b/.test(normalize(item.title || ''))) return found
      if (!found || (Date.parse(item.completedAt) || 0) > (Date.parse(found.completedAt) || 0)) return item
      return found
    }, null)
    if (!latest) return language === 'en' ? 'You have not logged an oil change yet. Check your version’s manual in the Catalog for the service interval.' : language === 'es' ? 'Aún no has registrado un cambio de aceite. Consulta el manual de tu versión en el Catálogo para ver el intervalo.' : 'Você ainda não registrou uma troca de óleo. Para conferir o intervalo, consulte o manual da sua versão no Catálogo.'
    const date = latest.completedAt ? ` em ${displayDate(latest.completedAt)}` : ''
    const recordedMileage = latest.km != null ? ` · ${Number(latest.km).toLocaleString(document.documentElement.lang || 'pt-BR')} km` : ''
    return `Último serviço registrado relacionado a óleo${date} · ${latest.title}${recordedMileage}.`
  }
  if (lower.includes('vencid') || lower.includes('atras') || lower.includes('overdue')) return language === 'en' ? `${maintenance.filter((item) => item.status === 'Atrasada').length} item(s) are marked overdue in your records. This is not a technical assessment; check the vehicle manual.` : language === 'es' ? `${maintenance.filter((item) => item.status === 'Atrasada').length} elemento(s) aparecen atrasados en tus registros. No es una evaluación técnica; consulta el manual del vehículo.` : `Há ${maintenance.filter((item) => item.status === 'Atrasada').length} item(ns) marcados como atrasados nos seus registros. Isso não é uma avaliação técnica: confirme o plano no manual do veículo.`
  if (/quilometragem|odometro|\bkm\b|mileage|kilometraje/.test(lower)) return language === 'en' ? `Mileage recorded: ${Number(mileage).toLocaleString(document.documentElement.lang || 'pt-BR')} km.` : language === 'es' ? `Kilometraje registrado: ${Number(mileage).toLocaleString(document.documentElement.lang || 'pt-BR')} km.` : `Quilometragem informada: ${Number(mileage).toLocaleString(document.documentElement.lang || 'pt-BR')} km.`
  if (lower.includes('carro') || lower.includes('coche') || lower.includes('car')) return language === 'en' ? `${vehicle?.brand || 'Vehicle'} ${vehicle?.model || ''} ${vehicle?.year || ''} · ${vehicle?.version || 'version not provided'}. Mileage: ${Number(mileage).toLocaleString(document.documentElement.lang || 'pt-BR')} km.` : language === 'es' ? `${vehicle?.brand || 'Vehículo'} ${vehicle?.model || ''} ${vehicle?.year || ''} · ${vehicle?.version || 'versión no indicada'}. Kilometraje: ${Number(mileage).toLocaleString(document.documentElement.lang || 'pt-BR')} km.` : `${vehicle?.brand || 'Veículo'} ${vehicle?.model || ''} ${vehicle?.year || ''} · ${vehicle?.version || 'versão não informada'}. Quilometragem: ${Number(mileage).toLocaleString(document.documentElement.lang || 'pt-BR')} km.`
  return language === 'en' ? 'I can help organize your records and expenses. For specifications, known faults, or dealer eligibility, check your manual and the manufacturer’s official sources.' : language === 'es' ? 'Puedo ayudarte a organizar tus registros y gastos. Para consultar especificaciones, fallos conocidos o cobertura del concesionario, revisa el manual y las fuentes oficiales de la marca.' : 'Posso ajudar a organizar seus registros e gastos. Para especificações, defeitos conhecidos ou elegibilidade em concessionária, confira o manual e as fontes oficiais da marca.'
}

function ThemeSwitch({ dark, onToggle }) {
  const { t } = useLanguage()
  return <button type="button" className="theme-switch" role="switch" aria-label={t('Modo escuro')} aria-checked={Boolean(dark)} onClick={onToggle}>
    <span className="theme-switch-track" aria-hidden="true"><Sun size={15} /><Moon size={15} /></span>
  </button>
}

function Header({ page, vehicle, profile, onNavigate, onVehicle, onProfile, onReminders, reminderCount = 0, dark, onToggleTheme }) {
  const { t } = useLanguage()
  const drawer = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const wideScreen = window.matchMedia('(min-width: 900px)')
    const closeOnResize = () => {
      if (wideScreen.matches) drawer.current?.close()
    }
    wideScreen.addEventListener('change', closeOnResize)
    return () => wideScreen.removeEventListener('change', closeOnResize)
  }, [])

  function openMenu() {
    drawer.current.showModal()
    setMenuOpen(true)
  }

  const themeSwitch = <ThemeSwitch dark={dark} onToggle={onToggleTheme} />
  return (
    <header className="app-header app-header-navigation">
      <div className="brand-row">
        <button type="button" className="icon-button nav-toggle" aria-label={t('Abrir menu')}
          aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-haspopup="dialog" onClick={openMenu}>
          <Menu size={22} />
        </button>
        <Navigation page={page} onNavigate={onNavigate} className="top-navigation" />
        <div className="header-actions">
          {themeSwitch}
          <LanguageSelector />
          <button type="button" className="header-vehicle" aria-label={t('Editar veículo')} title={t('Editar veículo')} onClick={onVehicle}>{t('Meu veículo')} <ChevronDown size={14} /></button>
          <button className="icon-button notification-icon" aria-label={`${t('Lembretes')} (${reminderCount})`} onClick={onReminders}><Bell size={18} />{reminderCount > 0 && <b>{reminderCount}</b>}</button>
          <button className="avatar-button" onClick={onProfile} aria-label={t('Abrir perfil')}>{(profile?.name || vehicle?.model || 'P').slice(0, 1)}</button>
        </div>
      </div>
      <dialog ref={drawer} className="nav-drawer" id="mobile-navigation" aria-labelledby="mobile-navigation-title"
        onClose={() => setMenuOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) drawer.current.close() }}>
        <div className="nav-drawer-content">
          <div className="nav-drawer-heading">
            <h2 id="mobile-navigation-title">{t('Menu')}</h2>
            <button type="button" className="icon-button" aria-label={t('Fechar menu')} onClick={() => drawer.current.close()}><X size={22} /></button>
          </div>
          <div className="drawer-preferences">{themeSwitch}<LanguageSelector /></div>
          <Navigation page={page} onNavigate={(id) => { drawer.current.close(); onNavigate(id) }} className="drawer-navigation" />
        </div>
      </dialog>
    </header>
  )
}

function Navigation({ page, onNavigate, className }) {
  const { t } = useLanguage()
  return <nav className={className} aria-label={t('Navegação principal')}>
    {navItems.map(({ id, label, icon: Icon }) => (
      <button type="button" key={id} aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
        <Icon size={18} aria-hidden="true" /><span>{t(label)}</span>
      </button>
    ))}
  </nav>
}

function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage()
  return <label className="language-selector"><span>{t('Idioma')}</span><select aria-label={t('Idioma')} value={language} onChange={(event) => setLanguage(event.target.value)}>
    <option value="pt">PT</option><option value="en">EN</option><option value="es">ES</option>
  </select></label>
}

function HomePage({ vehicle, profile, mileage, maintenance, completedMaintenance, awaitingMaintenance, onMileageSave, onOpen, reminders, expenseSummary }) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [mileageDraft, setMileageDraft] = useState(mileage)
  const shown = vehicle?.model || 'seu veículo'
  const overdue = maintenance.filter((item) => item.status === 'Atrasada').length
  const dueSoon = maintenance.filter((item) => item.status === 'Em breve').length
  const latest = maintenance.slice(0, 3)
  return <div className="home-stack">
    <header className="dashboard-intro">
      <h1>{t('Seu carro,')} <span>{t('sob controle.')}</span></h1>
      <p>{t('Manutenção, gastos e documentos organizados em um só lugar.')}</p>
    </header>
    <section className="home-bento" aria-label={t('Resumo do veículo')}>
      <article className="hero-card vehicle-panel">
        <div className="panel-overline">{t('VEÍCULO ATUAL')}</div>
        <div className="vehicle-panel-main"><div className="vehicle-mark" aria-hidden="true">{(vehicle?.brand || '—').slice(0, 1)}</div><div className="vehicle-name"><small>{vehicle?.brand || t('VEÍCULO')}</small><strong>{shown}</strong><small>{vehicle?.year || t('Ano não informado')}{vehicle?.version ? ` · ${vehicle.version}` : ''}</small></div></div>
        <div className="vehicle-panel-footer"><div><span className="metric-label">{t('QUILOMETRAGEM')}</span><strong>{Number(mileage).toLocaleString(document.documentElement.lang || 'pt-BR')} <small>km</small></strong></div>{!editing && <button className="text-action" onClick={() => { setMileageDraft(mileage); setEditing(true) }}>{t('Atualizar')}</button>}</div>
        {editing && <form className="inline-mileage" onSubmit={(event) => { event.preventDefault(); onMileageSave(mileageDraft); setEditing(false) }}><input aria-label={t('Quilometragem atual')} type="number" min="0" required value={mileageDraft} onChange={(event) => setMileageDraft(event.target.value)} /><span>km</span><button type="submit" aria-label={t('Salvar quilometragem')}><Check size={17} /></button><button type="button" aria-label={t('Cancelar edição')} onClick={() => setEditing(false)}><X size={17} /></button></form>}
      </article>
      <article className="surface-card service-panel">
        <div className="panel-heading"><div><div className="panel-overline">{t('MANUTENÇÃO')}</div><h2>{t('Um olhar rápido')}</h2></div><button className="quiet-icon" aria-label={t('Ver manutenções')} onClick={() => onOpen('manutencoes')}><ArrowRight size={17} /></button></div>
        <div className="service-stats"><div><strong className="tone-red">{overdue}</strong><span>{t('atrasadas')}</span></div><div><strong className="tone-amber">{dueSoon}</strong><span>{t('em breve')}</span></div><div><strong>{completedMaintenance}</strong><span>{t('concluídas')}</span></div></div>
        <p className="service-footnote">{awaitingMaintenance ? `${awaitingMaintenance} ${t('registros aguardam confirmação.')}` : t('Os registros ficam disponíveis no seu histórico.')}</p>
      </article>
      <button className="feature-tile feature-expenses" onClick={() => onOpen('gastos')}><span className="feature-index">01 / {t('FINANÇAS')}</span><Wallet size={19} /><strong>{t('Gastos do veículo')}</strong><span>{t('Acompanhe despesas e abastecimentos.')}</span><i><ArrowRight size={16} /></i></button>
      <button className="feature-tile feature-history" onClick={() => onOpen('historico')}><span className="feature-index">02 / {t('HISTÓRICO')}</span><History size={19} /><strong>{t('Um histórico claro')}</strong><span>{t('Serviços e lembretes, em ordem.')}</span><i><ArrowRight size={16} /></i></button>
      <button className="feature-tile feature-catalog" onClick={() => onOpen('catalogo')}><span className="feature-index">03 / {t('DOCUMENTOS')}</span><BookOpen size={19} /><strong>{t('Catálogo técnico')}</strong><span>{t('Consulte os manuais da sua versão.')}</span><i><ArrowRight size={16} /></i></button>
      <article className="surface-card timeline-panel">
        <div className="panel-heading"><div><div className="panel-overline">{t('ATIVIDADE')}</div><h2>{t('Seus registros recentes')}</h2></div><button className="text-action" onClick={() => onOpen('historico')}>{t('Ver histórico')} <ArrowRight size={14} /></button></div>
        {latest.length ? <div className="home-timeline">{latest.map((item, index) => <div className="home-timeline-row" key={item.id || `${item.title}-${index}`}><span className={`timeline-dot ${item.status === 'Concluída' ? 'is-done' : ''}`} /><span><strong>{t(item.title)}</strong><small>{t(item.detail || item.status)}</small></span><em>{t(item.status)}</em></div>)}</div> : <p className="service-footnote">{t('Seus serviços concluídos aparecerão aqui.')}</p>}
      </article>
      <article className="surface-card spend-panel"><div className="panel-overline">{t('ESTE MÊS')}</div><h2>{t('Gastos registrados')}</h2><strong>{money(expenseSummary?.total || 0)}</strong><button className="text-action" onClick={() => onOpen('gastos')}>{t('Ver extrato')} <ArrowRight size={14} /></button></article>
      {reminders.length > 0 && <article className="surface-card reminder-panel"><div className="panel-overline">{t('LEMBRETES')}</div><h2>{t('Próximos passos')}</h2>{reminders.slice(0, 2).map((item) => <p className="reminder-row" key={item.id}><CalendarDays size={16} />{item.title}</p>)}</article>}
    </section>
  </div>
}

function MaintenancePage({ maintenance, onComplete, onReminder, onManual, vehicle }) {
  const { t } = useLanguage()
  const [tab, setTab] = useState('manutencoes')
  const [filter, setFilter] = useState('todas')
  const countComplete = maintenance.filter((item) => item.status === 'Concluída').length
  const revisionItems = maintenance.filter((item) => item.title.toLowerCase().includes('revis'))
  const sourceList = tab === 'revisoes' ? revisionItems : maintenance
  const list = filter === 'atrasadas' ? sourceList.filter((item) => item.status === 'Atrasada') : filter === 'em breve' ? sourceList.filter((item) => item.status === 'Em breve') : filter === 'em dia' ? sourceList.filter((item) => item.status === 'Concluída') : sourceList
  return <div className="page-content maintenance-page">
    <div className="segment-control"><button className={tab === 'manutencoes' ? 'active' : ''} onClick={() => setTab('manutencoes')}>{t('Manutenções')} <span>{maintenance.length}</span></button><button className={tab === 'revisoes' ? 'active' : ''} onClick={() => setTab('revisoes')}>{t('Revisões')}</button></div>
    <section className="surface-card calibration-card"><div className="calibrate-header"><span className="round-icon"><CircleHelp size={18} /></span><div><strong>{t('Plano por confirmar')}</strong><small>{vehicle?.brand || t('Marca')} {vehicle?.model || ''} · {vehicle?.year || t('ano não informado')}</small></div></div><p>{t('Os intervalos variam por ano e motorização. Registre serviços já feitos e consulte os dados oficiais disponíveis.')}</p></section>
    <div className="filter-chips">{['Todas', 'Atrasadas', 'Em breve', 'Em dia'].map((value) => { const key = value.toLowerCase(); const scope = tab === 'revisoes' ? revisionItems : maintenance; const count = value === 'Todas' ? scope.length : value === 'Atrasadas' ? scope.filter((item) => item.status === 'Atrasada').length : value === 'Em breve' ? scope.filter((item) => item.status === 'Em breve').length : scope.filter((item) => item.status === 'Concluída').length; return <button key={value} className={filter === key ? 'chip-active' : ''} onClick={() => setFilter(key)}><ShieldCheck size={12} />{value === 'Todas' ? `${t(value)} ${count}` : `${t(value)} ${count}`}</button> })}</div>
    <div className="list-intro"><span>{maintenance.length} {t('REGISTROS')}</span><span>{countComplete} {t('concluídas · dados técnicos exigem fonte específica')}</span></div>
    {list.length ? <div className="maintenance-list">{list.map((item, i) => { const Icon = typeof item.icon === 'function' ? item.icon : Wrench; const Row = item.status === 'Concluída' ? 'div' : 'button'; return <Row className={`maintenance-row ${item.status === 'Concluída' ? 'row-complete' : ''}`} key={`${item.title}-${i}`} onClick={Row === 'button' ? () => onComplete(item) : undefined}><span className="maintenance-icon"><Icon size={17} /></span><span className="maintenance-copy"><b>{t(item.title)}</b><small>{t(item.detail)}</small></span><span className="maintenance-status">{t(item.status)}{Row === 'button' && <ChevronRight size={15} />}</span></Row> })}</div> : <section className="surface-card revision-empty"><Wrench size={19} /><b>{t(tab === 'revisoes' ? 'Nenhuma revisão registrada' : 'Nenhum serviço registrado')}</b><span>{t('Registre um serviço feito ou consulte as fontes disponíveis no Catálogo.')}</span><button className="yellow-button" onClick={onManual}>{t('Registrar serviço')} <Plus size={16} /></button></section>}
    <section className="surface-card next-review"><div className="card-heading"><div><h2>{t('Próxima revisão')}</h2><p>{t('Sem agenda técnica confirmada')}</p></div><CalendarDays size={18} /></div><p>{t('Cadastre um lembrete com base no manual do seu veículo ou na orientação da concessionária.')}</p><button className="yellow-button" onClick={onReminder}>{t('Criar lembrete')} <ArrowRight size={16} /></button></section>
  </div>
}

function ExpensesPage({ expenses, summary, onAdd, onRemove }) {
  const { t } = useLanguage()
  const [view, setView] = useState('extrato')
  const { total: monthTotal, count, buckets } = summary
  return <div className="page-content expenses-page">
    <div className="segment-control"><button className={view === 'extrato' ? 'active' : ''} onClick={() => setView('extrato')}><Menu size={14} />{t('Extrato')}</button><button className={view === 'graficos' ? 'active' : ''} onClick={() => setView('graficos')}><SlidersHorizontal size={14} />{t('Gráficos')}</button></div>
    <section className="surface-card month-total"><small>{t('ESTE MÊS')}</small><strong>{money(monthTotal)}</strong><p>{t('Valores dos registros neste mês.')}</p><div className="month-stat"><div><b>{count}</b><span>{t('LANÇAMENTOS')}</span></div><div><b>{count ? money(monthTotal / count) : '—'}</b><span>{t('TICKET MÉDIO')}</span></div></div></section>
    {view === 'graficos' ? <section className="surface-card chart-card"><h2>{t('Seus gastos por categoria')}</h2>{['Abastecimento', 'Manutenção', 'Gasto avulso', 'Conta fixa'].map((type) => <div className="chart-row" key={type}><span>{t(type)}</span><div className="chart-track"><i style={{ width: `${monthTotal ? (buckets[type] || 0) / monthTotal * 100 : 0}%` }} /></div><b>{money(buckets[type] || 0)}</b></div>)}<p className="muted-note">{t('Os gráficos consideram apenas os lançamentos do mês atual.')}</p></section> : expenses.length ? <section className="surface-card expenses-list"><h2>{t('Seu extrato')}</h2>{expenses.map((item) => <div className="expense-row" key={item.id}><span className="round-icon"><Wallet size={17} /></span><span><b>{t(item.title)}</b><small>{t(item.type)} · {displayDate(item.date)}</small></span><strong>{money(item.amount)}</strong><button className="remove-expense" title={`${t('Remover')} ${t(item.title)}`} aria-label={`${t('Remover')} ${t(item.title)}`} onClick={() => onRemove(item.id)}><X size={15} /></button></div>)}</section> : <section className="surface-card empty-expenses"><div className="empty-wallet"><Wallet size={27} /></div><h2>{t('Seus gastos, num lugar só.')}</h2><p>{t('Registre abastecimentos, despesas e serviços para acompanhar os valores por mês.')}</p><button className="yellow-button" onClick={onAdd}>{t('Registrar primeiro gasto')} <Plus size={16} /></button></section>}
  </div>
}

function CopilotPage({ vehicle, profile, mileage, conversation, query, setQuery, onSubmit, onSuggestion }) {
  const { t } = useLanguage()
  const suggestions = ['O que está vencido?', 'Qual é a quilometragem do meu carro?', 'Quanto gastei este mês?', 'Quando registrei a última troca de óleo?']
  const messages = useRef(null)
  useEffect(() => {
    const list = messages.current
    if (list) list.scrollTop = list.scrollHeight
  }, [conversation])

  return <div className="page-content copilot-page">
    <div className="copilot-intro"><h1>{t('Olá')}{profile?.name ? `, ${profile.name}` : ''}. {t('Vamos organizar os dados do seu')} {vehicle?.model || t('veículo')}.</h1><p>{Number(mileage).toLocaleString(document.documentElement.lang || 'pt-BR')} km {t('informados. Pergunte sobre seus registros, gastos e fontes de manutenção disponíveis.')}</p></div>
    {conversation.length === 0 && <section className="copilot-suggestions" aria-labelledby="copilot-suggestions-title">
      <h2 className="section-title" id="copilot-suggestions-title">{t('Sugestões para começar')}</h2>
      <div className="suggestion-grid">{suggestions.map((text, i) => <button key={text} className="suggestion-card" onClick={() => onSuggestion(t(text))}><span className="suggestion-dot" aria-hidden="true">{['⚠', '◎', '↗', '⌕'][i]}</span><b>{t(text)}</b><ChevronRight size={14} /></button>)}</div>
    </section>}
    <section className="recent-conversations">
      <h2 id="copilot-conversation-title">{t('Conversa atual')}</h2>
      {conversation.length > 0
        ? <div className="conversation-list" aria-labelledby="copilot-conversation-title" role="log" ref={messages} tabIndex={0}>{conversation.map((message, i) => <div key={i} className={`chat-bubble ${message.role}`}>{message.text}</div>)}</div>
        : <div className="recent-empty"><MessageCircle size={23} aria-hidden="true" /><span>{t('Envie uma pergunta para começar.')}</span></div>}
    </section>
    <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); onSubmit() }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Pergunte ao Copiloto...')} aria-label={t('Mensagem para o Copiloto')} /><button aria-label={t('Enviar mensagem')} disabled={!query.trim()}><ArrowRight size={19} /></button></form><small className="copilot-footnote">{t('O Copiloto pode errar. Confirme com um mecânico.')}</small>
  </div>
}

function HistoryPage({ maintenance, expenses, reminders, onRegister }) {
  const { t } = useLanguage()
  const hasRecords = maintenance.some((item) => item.status === 'Concluída') || expenses.length > 0 || reminders.length > 0
  return <div className="page-content history-page">
    {hasRecords && <section className="surface-card report-card"><div className="report-kicker">{t('HISTÓRICO LOCAL')}</div><h2>{t('Registros do seu veículo')}</h2><p>{t('Consulte os serviços, gastos e lembretes que você anotou.')}</p><div className="report-preview"><b>{t('Histórico de manutenção')}</b><span>{t('Dados registrados neste dispositivo')}</span><hr /><div>{maintenance.filter((item) => item.status === 'Concluída').length} {t('MANUTENÇÕES')}　 ·　 {expenses.length} {t('GASTOS')}</div><p>{t('Este resumo não substitui notas fiscais ou documento técnico.')}</p></div><button className="outline-button" onClick={onRegister}>{t('Registrar manutenção')} <Plus size={16} /></button></section>}
    <section className="surface-card history-start"><div className="history-progress-heading"><h2>{t('Seu histórico')}</h2><b>{maintenance.filter((item) => item.status === 'Concluída').length} {t('serviços')}</b></div><p>{t('Registros locais de manutenção, gastos e lembretes.')}</p></section>
    <h2 className="section-title timeline-heading">{t('Linha do tempo')} <small>{maintenance.filter((item) => item.status === 'Concluída').length} {t('manutenções')}</small></h2>
    <section className="surface-card timeline-card">
      {!hasRecords && <p>{t('Nenhum registro ainda.')}</p>}
      {historyEntries(maintenance, expenses, reminders).map((item) => {
        const Icon = item.kind === 'Serviço' ? Check : item.kind === 'Lembrete' ? CalendarDays : Wallet
        return <div className="timeline-item" key={item.key}>
          <span className="timeline-pin"><Icon size={12} /></span>
          <div><strong>{item.title}</strong><small>{t(item.kind)} · {displayDate(item.date)}{item.km != null ? ` · ${Number(item.km).toLocaleString(document.documentElement.lang || 'pt-BR')} km` : ''}</small></div>
        </div>
      })}
    </section>
  </div>
}

function CatalogPage() {
  return <div className="page-content catalog-page">
    <FipeLookup catalog />
  </div>
}

function Onboarding({ step, setStep, draft, setDraft, onFinish, onToast }) {
  const { t } = useLanguage()
  const set = (key, value) => setDraft((old) => ({ ...old, [key]: value }))
  const advance = () => {
    if (step === 1) {
      if (!draft.make.trim() || !draft.model.trim() || !/^[0-9]{4}$/.test(draft.year) || Number(draft.year) < 1950 || Number(draft.year) > new Date().getFullYear() + 1) { onToast(t('Informe marca, modelo e ano para continuar')); return }
    }
    if (step === 2) { setStep(step + 1); return }
    if (step === 4) { onFinish(); return }
    setStep(step + 1)
  }
  return <div className="onboarding">
    <div className="onboarding-top"><span className="phone-notch" />{step > 1 && <button onClick={() => setStep(step - 1)} aria-label={t('Voltar')}><ArrowLeft size={21} /></button>}<div className="onboarding-top-brand">{step > 2 ? t('Seu veículo') : ''}</div><LanguageSelector /></div>
    {step === 1 && <div className="onboarding-content plate-step"><small className="eyebrow">{t('CADASTRO DO VEÍCULO')}</small><h1>{t('Qual veículo vamos acompanhar?')}</h1><p>{t('Selecione a marca, o modelo, o ano e a versão disponíveis no catálogo FIPE.')}</p><FipeLookup onUse={(item) => setDraft((old) => ({ ...old, make: item.brand, model: item.model, version: [item.selectedVersion, item.selectedFuel].filter(Boolean).join(' · '), year: String(item.modelYear) }))} /><button className="yellow-button onboarding-cta" disabled={!draft.make.trim() || !draft.model.trim() || !draft.year || !draft.version} onClick={advance}>{t('Continuar')} <ArrowRight size={16} /></button></div>}
    {step === 2 && <div className="onboarding-content found-step"><small className="eyebrow">{t('DADOS INFORMADOS')}</small><Car size={42} /><h1>{draft.make} {draft.model}</h1><div className="fipe-card"><span>{t('VERSÃO E ANO')}</span><b>{draft.version || t('Versão não informada')}</b><div><span>{t('ANO')}<br /><b>{draft.year}</b></span><span>{t('COBERTURA')}<br /><b>{t('A confirmar')}</b></span></div></div><p>{t('Cadastro baseado nos dados que você informou. O plano depende de documentação específica disponível no catálogo.')}</p><button className="yellow-button onboarding-cta" onClick={advance}>{t('Confirmar veículo')} <Check size={17} /></button><button className="link-button" onClick={() => setStep(1)}>{t('Editar dados')}</button></div>}
    {step === 3 && <div className="onboarding-content city-step"><small className="eyebrow">{t('ÚLTIMOS AJUSTES')}</small><h1>{t('Em que cidade você mora?')}</h1><p>{t('Opcional. Pode ajudar a organizar serviços locais futuramente.')}</p><label className="form-field">{t('Cidade')} <span>({t('opcional')})</span><input autoFocus value={draft.city} onChange={(event) => set('city', event.target.value)} /></label><label className="form-field">{t('Seu nome')} <span>({t('opcional')})</span><input value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder={t('Como podemos chamar você?')} /></label><button className="yellow-button onboarding-cta" onClick={advance}>{t('Continuar')} <ArrowRight size={16} /></button></div>}
    {step === 4 && <div className="onboarding-content account-step"><h1>{t('Seu veículo')}<br /><mark>{t('organizado')}</mark></h1><p>{t('Cadastre serviços e gastos, consulte a cobertura do catálogo e acompanhe seus lembretes.')}</p><div className="app-preview"><div><Car size={17} /> {draft.make} {draft.model} · {draft.year}</div><strong>{draft.version || t('Versão a confirmar')}</strong><span>{t('Dados técnicos: consulte as fontes disponíveis.')}</span><span className="yellow-bar" /></div><button className="yellow-button onboarding-cta" onClick={onFinish}>{t('Começar')} <ArrowRight size={17} /></button></div>}
    <div className="onboarding-progress"><span style={{ width: `${Math.max(8, step / 4 * 100)}%` }} /></div>
  </div>
}

function Modal({ name, close, onEditVehicle, onExpense, onMaintenance, onCompleteMaintenance, onReminder, onToast, profile, setProfile, mileage, setMileage, vehicle, setVehicle, reminders = [], initialTitle = '', initialMileage = mileage, maintenanceItem = {} }) {
  const { t, locale } = useLanguage()
  const [title, setTitle] = useState(initialTitle)
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('Abastecimento')
  const [date, setDate] = useState('')
  const [mileageDraft, setMileageDraft] = useState(initialMileage)
  const [liters, setLiters] = useState('')
  const [fuelMileage, setFuelMileage] = useState(mileage)
  const [nameDraft, setNameDraft] = useState(profile?.name || '')
  const [checked, setChecked] = useState({})
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const submitExpense = (event) => { event.preventDefault(); if (!title.trim() || !amount) return; onExpense({ title: title.trim(), amount: Number(amount), type, ...(type === 'Abastecimento' ? { liters: liters ? Number(liters) : null, mileage: fuelMileage ? Number(fuelMileage) : null } : {}), date: date || new Date().toISOString() }) }
  const submitMaintenance = (event) => { event.preventDefault(); if (!title.trim()) return; onMaintenance(title.trim(), amount, mileageDraft, date, checked.invoice || false) }
  const submitReminder = (event) => { event.preventDefault(); if (!title.trim()) return; onReminder(title.trim(), date) }
  useEffect(() => {
    const dismiss = (event) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [close])

  const modalTitles = { expense: 'Registrar gasto', maintenance: 'Registrar manutenção', 'complete-maintenance': 'Concluir serviço', reminder: 'Criar novo lembrete', profile: 'Seu perfil', vehicle: 'Editar veículo', notifications: 'Avisos e lembretes' }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="modal-handle" /><div className="modal-heading"><div><h2 id="dialog-title">{t(modalTitles[name])}</h2><p>{vehicle?.brand || t('Veículo')} {vehicle?.model || ''} · {vehicle?.year || t('ano não informado')}</p></div><button className="close-modal" onClick={close} aria-label={t('Fechar')}><X size={19} /></button></div>
    {name === 'expense' && <form onSubmit={submitExpense}><label className="form-field">{t('Tipo do gasto')}<select value={type} onChange={(e) => setType(e.target.value)}>{['Abastecimento', 'Manutenção', 'Gasto avulso', 'Conta fixa'].map((x) => <option key={x}>{t(x)}</option>)}</select></label><label className="form-field">{t('Descrição')}<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'Abastecimento' ? t('Gasolina, etanol…') : t('Ex.: troca de óleo')} required /></label><label className="form-field">{t('Valor')}<input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 0,00" required /></label><label className="form-field">{t('Data')}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>{type === 'Abastecimento' && <><label className="form-field">{t('Litros')} <span>({t('opcional')})</span><input type="number" min="0" step="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="Ex.: 38" /></label><label className="form-field">{t('Quilometragem')} <span>({t('opcional')})</span><input type="number" min="0" value={fuelMileage} onChange={(e) => setFuelMileage(e.target.value)} /></label></>}<button className="yellow-button modal-submit">{t('Salvar gasto')} <Check size={17} /></button></form>}
    {name === 'maintenance' && <form onSubmit={submitMaintenance}><label className="form-field">{t('O que foi feito?')}<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Ex.: troca de óleo')} required /></label><label className="form-field">{t('Quilometragem')}<input type="number" min="0" value={mileageDraft} onChange={(e) => setMileageDraft(Number(e.target.value))} /></label><label className="form-field">{t('Valor gasto')} <span>({t('opcional')})</span><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 0,00" /></label><label className="form-field">{t('Data')}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label className="check-option"><input type="checkbox" checked={checked.invoice || false} onChange={(e) => setChecked((old) => ({ ...old, invoice: e.target.checked }))} /> {t('Tenho nota fiscal do serviço')}</label><button className="yellow-button modal-submit">{t('Registrar manutenção')} <Check size={17} /></button></form>}
    {name === 'complete-maintenance' && <form onSubmit={(event) => { event.preventDefault(); onCompleteMaintenance(maintenanceItem, amount, mileageDraft, date) }}><label className="form-field">{t('Serviço')}<input value={title} readOnly required /></label><label className="form-field">{t('Quilometragem')}<input type="number" min="0" value={mileageDraft} onChange={(e) => setMileageDraft(Number(e.target.value))} /></label><label className="form-field">{t('Valor gasto')} <span>({t('opcional')})</span><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><label className="form-field">{t('Data')}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><button className="yellow-button modal-submit">{t('Marcar como concluído')} <Check size={17} /></button></form>}
    {name === 'reminder' && <form onSubmit={submitReminder}><label className="form-field">{t('O que lembrar?')}<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Ex.: revisão do carro')} required /></label><label className="form-field">{t('Quando?')}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><p className="muted-note">{t('O lembrete fica salvo no painel; avisos automáticos no celular ainda não estão conectados.')}</p><button className="yellow-button modal-submit">{t('Criar lembrete')} <CalendarDays size={17} /></button></form>}
    {name === 'profile' && <form onSubmit={(e) => { e.preventDefault(); setProfile((old) => ({ ...old, name: nameDraft.trim() })); close(); onToast('Perfil atualizado') }}><label className="form-field">{t('Seu nome')}<input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} /></label><label className="form-field">{t('Seu veículo')}<input readOnly value={`${vehicle?.brand || ''} ${vehicle?.model || ''} ${vehicle?.version || ''} · ${vehicle?.year || ''}`.trim()} /></label><button className="yellow-button modal-submit">{t('Salvar perfil')} <Check size={17} /></button><button type="button" className="link-button" onClick={onEditVehicle}>{t('Editar veículo')}</button></form>}
    {name === 'vehicle' && <form onSubmit={(e) => { e.preventDefault(); if (!selectedVehicle) return; const form = e.currentTarget; setVehicle((old) => ({ ...old, ...selectedVehicle, plate: form.elements.namedItem('plate').value.toUpperCase() })); close(); onToast('Veículo atualizado') }}><p className="muted-note">{t('Escolha o veículo nos mesmos campos do catálogo técnico.')}</p><FipeLookup onUse={(item) => setSelectedVehicle({ brand: item.brand, model: item.model, version: [item.selectedVersion, item.selectedFuel].filter(Boolean).join(' · '), year: String(item.modelYear) })} /><label className="form-field">{t('Placa')}<input name="plate" defaultValue={vehicle?.plate || ''} maxLength="7" /></label>{selectedVehicle && <p role="status">{t('Selecionado:')} {selectedVehicle.brand} {selectedVehicle.model} · {selectedVehicle.version} · {selectedVehicle.year}</p>}<button className="yellow-button modal-submit" disabled={!selectedVehicle}>{t('Salvar veículo')} <Check size={17} /></button></form>}
    {name === 'notifications' && <div className="notification-list">{reminders.length ? reminders.map((item) => <div key={item.id}><span className="round-icon"><Bell size={17} /></span><span><b>{item.title}</b><small>{item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString(locale) : t('Data não definida')} · {t('lembrete salvo')}</small></span></div>) : <div><span className="round-icon"><Bell size={17} /></span><span><b>{t('Nenhum lembrete cadastrado')}</b><small>{t('Crie um lembrete para vê-lo aqui. Avisos automáticos não estão conectados.')}</small></span></div>}<button className="yellow-button modal-submit" type="button" onClick={() => { close(); document.dispatchEvent(new CustomEvent('lembracar:new-reminder')) }}>{t('Criar lembrete')} <Plus size={16} /></button></div>}
  </section></div>
}

createRoot(document.getElementById('root')).render(<LanguageProvider><App /></LanguageProvider>)
