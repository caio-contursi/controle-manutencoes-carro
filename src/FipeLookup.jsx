import React, { useEffect, useState } from 'react'

export default function FipeLookup({ onUse }) {
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [lists, setLists] = useState({ brands: [], models: [], years: [] })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, retry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (brand) params.set('brand', brand)
    if (model) params.set('model', model)
    if (year) params.set('year', year)
    const list = !brand ? 'brands' : !model ? 'models' : !year ? 'years' : null
    setLoading(true)
    setError('')
    fetch('/api/fipe/cars?' + params, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        if (controller.signal.aborted) return
        if (list) setLists((previous) => ({ ...previous, [list]: data }))
        else setResult(data)
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || 'Falha na consulta.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [brand, model, year, attempt])

  function select(label, value, options, change, disabled) {
    return <label className="form-field">{label}
      <select value={value} onChange={(event) => change(event.target.value)} disabled={disabled}>
        <option value="">Selecione</option>
        {options.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
      </select>
    </label>
  }

  return <section className="surface-card">
    <h2>Consultar preço de referência FIPE</h2>
    {select('Marca FIPE', brand, lists.brands, (value) => {
      setBrand(value); setModel(''); setYear(''); setResult(null)
      setLists((previous) => ({ ...previous, models: [], years: [] }))
    })}
    {select('Modelo FIPE', model, lists.models, (value) => {
      setModel(value); setYear(''); setResult(null)
      setLists((previous) => ({ ...previous, years: [] }))
    }, !brand)}
    {select('Ano e combustível', year, lists.years, (value) => { setYear(value); setResult(null) }, !model)}
    {loading && <p role="status">Consultando dados…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => retry((count) => count + 1)}>Tentar novamente</button></p>}
    {!loading && !error && !result && (brand && !model && !lists.models.length || model && !year && !lists.years.length) && <p>Nenhuma opção encontrada para esta seleção.</p>}
    {result && <div aria-live="polite">
      <p>{result.brand} {result.model} · {result.modelYear === 32000 ? 'Zero km' : result.modelYear} · {result.fuel}</p>
      <p><strong>{result.price}</strong> · {result.referenceMonth} · Código FIPE {result.codeFipe}</p>
      {onUse && result.modelYear !== 32000 && <button type="button" className="yellow-button" onClick={() => onUse(result)}>Usar no cadastro</button>}
    </div>}
    <p className="muted-note">Fonte <a href="https://deividfortuna.github.io/fipe/v2/" target="_blank" rel="noreferrer">Fipe API</a>. O valor é uma média de referência.</p>
  </section>
}
