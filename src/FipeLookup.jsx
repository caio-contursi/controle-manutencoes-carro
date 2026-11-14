import React, { useEffect, useMemo, useState } from 'react'
import { fipeFamily, formatFipeModel } from './fipe-variants.js'

async function lookup(params, signal) {
  const response = await fetch('/api/fipe/cars?' + new URLSearchParams(params), { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Falha na consulta FIPE.')
  return data
}

export default function FipeLookup({ onUse, className = '' }) {
  const [brand, setBrand] = useState('')
  const [family, setFamily] = useState('')
  const [year, setYear] = useState('')
  const [selection, setSelection] = useState('')
  const [brands, setBrands] = useState([])
  const [models, setModels] = useState([])
  const [years, setYears] = useState([])
  const [variants, setVariants] = useState([])
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, retry] = useState(0)

  const families = useMemo(() => {
    const grouped = new Map()
    for (const model of models) {
      const name = fipeFamily(model.name)
      const key = name.toLocaleLowerCase('pt-BR')
      if (!grouped.has(key)) grouped.set(key, { code: key, name })
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [models])
  const selected = variants.find((variant) => variant.code + '/' + variant.yearCode === selection)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    const tasks = [
      [!brand, () => lookup({}, signal), setBrands],
      [brand && !family, () => lookup({ brand }, signal), setModels],
      [family && !year, () => lookup({ brand, family }, signal), setYears],
      [selected, () => lookup({ brand, model: selected.code, year: selected.yearCode }, signal), setResult],
      [family && year, () => lookup({ brand, family, year }, signal), setVariants],
    ]
    const task = tasks.find(([active]) => active)
    if (!task) {
      setLoading(false)
      setError('')
      return
    }
    const [, request, save] = task
    setLoading(true)
    setError('')
    request().then((data) => { if (!signal.aborted) save(data) })
      .catch((failure) => { if (!signal.aborted) setError(failure.message) })
      .finally(() => { if (!signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [brand, family, year, selected, attempt])

  const clearQuote = () => { setSelection(''); setResult(null) }

  function select(label, value, options, change, disabled, placeholder = 'Selecione') {
    return <label className="form-field" key={label}>{label}
      <select value={value} onChange={(event) => change(event.target.value)} disabled={disabled}>
        <option value="">{placeholder}</option>
        {options.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
      </select>
    </label>
  }

  return <section className={`surface-card ${className}`}>
    <h2>Consultar preço de referência FIPE</h2>
    {select('Marca FIPE', brand, brands, (value) => {
      setBrand(value); setFamily(''); setYear(''); setModels([]); setYears([]); setVariants([]); clearQuote()
    })}
    {select('Carro', family, families, (value) => {
      setFamily(value); setYear(''); setYears([]); setVariants([]); clearQuote()
    }, !models.length)}
    {select('Ano-modelo', year, years, (value) => {
      setYear(value); setVariants([]); clearQuote()
    }, !years.length)}
    {year && <>
      {select('Modelo', selection, variants.map((variant) => ({
        code: variant.code + '/' + variant.yearCode,
        name: variant.name + (variant.fuel ? ' · ' + variant.fuel : ''),
      })), (value) => { setSelection(value); setResult(null) }, !variants.length)}
    </>}
    {loading && <p role="status">Consultando dados…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => retry((count) => count + 1)}>Tentar novamente</button></p>}
    {!loading && !error && family && !years.length && <p>Nenhum ano-modelo encontrado na FIPE para este carro.</p>}
    {!loading && !error && year && !variants.length && <p>Nenhum modelo FIPE encontrado para este carro e ano.</p>}
    {result && <div aria-live="polite">
      <p className="fipe-result-price">
        <strong className="fipe-price-value">{result.price}</strong>
      </p>
      {result.manuals?.map((manual) => {
        const pdf = manual.token && '/api/catalog/manual-pdf?token=' + encodeURIComponent(manual.token)
        return <div className="fipe-manual" key={manual.external_url + manual.edition}>
          <div className="fipe-manual-actions">
            <a href={pdf || manual.external_url} target="_blank" rel="noreferrer">Visualizar manual</a>
            {pdf && <a href={pdf + '&download=1'} download>Baixar PDF</a>}
          </div>
        </div>
      })}
      {!result.manuals?.length && <p className="muted-note">
        Manual de fábrica ainda não confirmado para este modelo e ano.
      </p>}
      {onUse && result.modelYear !== 32000 && <button type="button" className="yellow-button" onClick={() => onUse({ ...result, model: formatFipeModel(result.model) })}>Usar no cadastro</button>}
    </div>}
  </section>
}
