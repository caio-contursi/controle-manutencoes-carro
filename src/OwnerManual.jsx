import React from 'react'
import { useLanguage } from './i18n.jsx'

export default function OwnerManual({ manual, actionsOnly = false, showEdition = false }) {
  const { t } = useLanguage()
  const pdf = manual.token && '/api/catalog/manual-pdf?token=' + encodeURIComponent(manual.token)
  return <div className="fipe-manual">
    {actionsOnly && showEdition && <strong>{manual.edition || manual.title}</strong>}
    {!actionsOnly && <>
      {manual.title && <strong>{manual.title}</strong>}
      {manual.matchLevel === 'model-year' && <p className="muted-note">{manual.notes}</p>}
    </>}
    <div className="fipe-manual-actions">
      <a href={pdf || manual.external_url} target="_blank" rel="noreferrer">{t('Visualizar manual')}</a>
      {pdf && <a href={pdf + '&download=1'} download>{t(actionsOnly ? 'Baixar manual em PDF' : 'Baixar PDF')}</a>}
      {!actionsOnly && manual.source && <a href={manual.source} target="_blank" rel="noreferrer">{t('Ver fonte')}</a>}
    </div>
  </div>
}
