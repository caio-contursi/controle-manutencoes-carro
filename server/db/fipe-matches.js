export const supportedFipeBrands = [
  ['59', 'Volkswagen'], ['23', 'Chevrolet'], ['21', 'Fiat'], ['22', 'Ford'],
  ['26', 'Hyundai'], ['48', 'Renault'], ['56', 'Toyota'], ['25', 'Honda'],
  ['29', 'Jeep'], ['43', 'Nissan'], ['44', 'Peugeot'], ['13', 'Citroën'],
].map(([code, name]) => ({ code, name }))

// A document may cover several versions. Only the explicit FIPE keys below inherit it.
export const ownerManuals = [
  {
    title: 'Fiat Palio, Siena e Strada Fire 2012',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/171/2012/handbook-2012-palio-strada-siena-fire.pdf',
    evidence: 'Capítulo E, p. E-2: Palio Fire Economy 1.0 Flex de duas e quatro portas e Strada Fire 1.4 de cabine simples ou estendida. O configurador Fiat da linha 2012 registra Celebration como pacote de opcionais do Fire Economy.',
    supporting_source: 'https://portal.tce.go.gov.br/documents/20181/68886/Recurso%2B-%2BRos%C3%A1rio/4f3a3e71-a504-4c76-b444-dcf68195bc9f?version=1.0',
    keys: [
      '21/4825/2012-5/001268-8', '21/4827/2012-5/001266-1', '21/4828/2012-5/001267-0',
      '21/602/2012-5/001222-0', '21/603/2012-5/001221-1',
    ],
  },
  {
    title: 'Fiat Novo Palio 2012',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/196/2012/handbook-2012-palio.pdf',
    evidence: 'Capítulo E, pp. E-3 a E-5: Attractive 1.0/1.4, Essence 1.6 e Sporting 1.6 com câmbio manual.',
    keys: ['21/5721/2012-5/001372-2', '21/5271/2012-5/001314-5', '21/5293/2012-5/001324-2', '21/5696/2012-5/001370-6'],
  },
  {
    title: 'Fiat Palio Fire Economy 2013',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/171/2013/handbook-2013-palio-fire.pdf',
    evidence: 'Capítulo E, p. E-2: Palio Fire Economy 1.0 Flex de duas e quatro portas. O manual abrange equipamentos opcionais de fábrica.',
    keys: ['21/4827/2013-5/001266-1', '21/4828/2013-5/001267-0'],
  },
  {
    title: 'Fiat Novo Palio 2013',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/196/2013/handbook-2013-palio.pdf',
    evidence: 'Capítulo E: Attractive 1.0/1.4, Essence 1.6 e Sporting 1.6 com câmbio manual. A série Interlagos usa o Sporting como base.',
    supporting_source: 'https://www.media.stellantis.com/br-pt/fiat/press/chega-ao-mercado-a-serie-especial-interlagos-para-novo-uno-e-novo-palio',
    keys: [
      '21/5721/2013-5/001372-2', '21/5271/2013-5/001314-5', '21/5293/2013-5/001324-2',
      '21/5696/2013-5/001370-6', '21/6318/2013-5/001397-8',
    ],
  },
  {
    title: 'Fiat Novo Palio 2014',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/196/2014/handbook-2014-palio.pdf',
    evidence: 'Capítulo E: Attractive 1.0/1.4, Essence 1.6 e Sporting 1.6 com câmbio manual. A série Interlagos usa o Sporting como base.',
    supporting_source: 'https://www.media.stellantis.com/br-pt/fiat/press/chega-ao-mercado-a-serie-especial-interlagos-para-novo-uno-e-novo-palio',
    keys: [
      '21/5721/2014-5/001372-2', '21/5271/2014-5/001314-5', '21/5293/2014-5/001324-2',
      '21/5696/2014-5/001370-6', '21/6318/2014-5/001397-8',
    ],
  },
  {
    title: 'Fiat Novo Palio 2015',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/196/2015/handbook-2015-palio.pdf',
    evidence: 'Capítulo E: Attractive 1.0/1.4, Essence 1.6 e Sporting 1.6 com câmbio manual. A Fiat identifica Best Seller 1.0 e 1.4 como séries sobre o Attractive.',
    supporting_source: 'https://www.media.stellantis.com/br-pt/fiat/press/novo-palio-ganha-serie-especial-best-seller-para-comemorar-a-lideranca-de-vendas-do-modelo',
    keys: [
      '21/5721/2015-5/001372-2', '21/5271/2015-5/001314-5', '21/5293/2015-5/001324-2',
      '21/5696/2015-5/001370-6', '21/7180/2015-5/001439-7', '21/7181/2015-5/001438-9',
    ],
  },
  {
    title: 'Fiat Palio 2016',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/196/2016/handbook-2016-palio.pdf',
    evidence: 'Capítulo E, pp. E-7 a E-13: Attractive 1.0, Attractive 1.4, Essence 1.6 e Sporting 1.6 com câmbio manual. A série Itália usa o Attractive 1.4 como base.',
    supporting_source: 'https://www.media.stellantis.com/br-pt/fiat/press/serie-especial-italia-chega-a-diversos-modelos-fiat',
    keys: ['21/5271/2016-5/001314-5', '21/5721/2016-5/001372-2', '21/5293/2016-5/001324-2', '21/5696/2016-5/001370-6'],
  },
  {
    title: 'Fiat Scudo 2023',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/508/2023/handbook-scudo-2023_2023.pdf',
    evidence: 'Capítulo H, p. H-9: Cargo e Multi 1.5 Diesel.',
    keys: ['21/9919/2023-3/001550-4', '21/9920/2023-3/001551-2'],
  },
  {
    title: 'Fiat Toro 2023',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/226/2023/handbook-toro-2023_2023.pdf',
    evidence: 'Capítulo H, pp. H-7 a H-16: Endurance, Freedom e Volcano 1.3 Turbo Flex, e Freedom, Volcano, Ranch e Ultra 2.0 Diesel 4x4.',
    keys: [
      '21/10069/2023-3/001487-7', '21/10070/2023-3/001516-4', '21/10071/2023-3/001525-3', '21/7479/2023-3/001453-2',
      '21/9493/2023-5/001537-7', '21/9494/2023-5/001538-5', '21/9495/2023-5/001539-3',
    ],
  },
  {
    title: 'Fiat Mobi 2022',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/341/2022/handbook-mobi-2022_2022.pdf',
    evidence: 'Capítulo H, pp. H-5 a H-6: Like e Trekking.',
    keys: ['21/7540/2022-5/001461-3', '21/9228/2022-5/001536-9'],
  },
  {
    title: 'Fiat Pulse 2022',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/363/2022/handbook-pulse-2022_2022.pdf',
    evidence: 'Capítulo H, Transmissão: 1.3 Flex manual e CVT, e Turbo 200 Flex CVT. Ficha de lançamento identifica Drive 1.3, Drive Turbo, Audace e Impetus.',
    supporting_source: 'https://www.media.stellantis.com/br-pt/fiat/press/fiat-pulse-versoes-e-precos',
    keys: [
      '21/9645/2022-5/001542-3', '21/9646/2022-5/001543-1', '21/9647/2022-5/001544-0',
      '21/9648/2022-5/001545-8', '21/9649/2022-5/001546-6',
    ],
  },
  {
    title: 'Fiat Cronos 2023',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/359/2023/handbook-cronos-2023_2023.pdf',
    evidence: 'Capítulo H, pp. H-2 a H-3 e H-7: Cronos 1.0, Drive 1.0, Drive 1.3 manual ou CVT e Precision 1.3 CVT.',
    supporting_source: 'https://www.media.stellantis.com/br-pt/fiat/press/fiat-cronos-ganha-novo-cambio-cvt-motor-firefly-1-0-e-traz-mudancas-no-design-na-linha-2023',
    keys: ['21/9988/2023-5/001552-0', '21/9989/2023-5/001553-9', '21/8200/2023-5/001505-9', '21/9990/2023-5/001554-7', '21/10394/2023-5/001555-5'],
  },
  {
    title: 'Fiat Strada 2022',
    external_url: 'https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/281/2022/handbook-strada-2022_2022.pdf',
    evidence: 'Capítulo H, pp. H-4 a H-7: Endurance 1.4 e Freedom 1.3 Cabine Plus ou Dupla, Volcano 1.3 manual ou CVT e Ranch 1.3 CVT.',
    supporting_source: 'https://www.media.stellantis.com/br-pt/fiat/press/fiat-inova-mais-uma-vez-com-a-nova-strada-com-cambio-automatico-01',
    keys: [
      '21/9108/2022-5/001529-6', '21/9109/2022-5/001526-1', '21/9110/2022-5/001527-0',
      '21/9111/2022-5/001530-0', '21/9723/2022-5/001548-2', '21/9112/2022-5/001528-8', '21/9724/2022-5/001549-0',
    ],
  },
  {
    title: 'Volkswagen Gol 2015',
    external_url: 'https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-gol/my-2015_154-5b1-gol-66.pdf',
    evidence: 'Dados técnicos, p. 190: Track 1.0 TOTALFLEX e Rallye 1.6 TOTALFLEX com câmbio manual ou I-Motion.',
    keys: ['59/6472/2015-5/005351-1', '59/6795/2015-5/005395-3', '59/6793/2015-5/005396-1'],
  },
  {
    title: 'Volkswagen Gol 2016',
    external_url: 'https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-gol/my-2016_161-5b1-gol-66.pdf',
    evidence: 'Dados técnicos, p. 131: Track 1.0 TOTALFLEX e Rallye 1.6 TOTALFLEX com câmbio manual ou I-Motion.',
    keys: ['59/6472/2016-5/005351-1', '59/6795/2016-5/005395-3', '59/6793/2016-5/005396-1'],
  },
  {
    title: 'Chevrolet Astra 2010',
    external_url: 'https://meu.chevrolet.com.br/content/dam/gmownercenter/gmsa/gmbr/dynamic/manuals/2010/chevrolet/Astra/pt/om_ng-chevrolet_Astra_my10-pt_BR.pdf',
    evidence: 'Seção 12: Hatchback e Sedan 2.0 Flexpower, câmbio manual e automático.',
    keys: ['23/4137/2010-5/004330-3', '23/3968/2010-5/004328-1', '23/3969/2010-5/004329-0', '23/4138/2010-5/004331-1'],
  },
  {
    title: 'Chevrolet Astra 2011',
    external_url: 'https://meu.chevrolet.com.br/content/dam/gmownercenter/gmsa/gmbr/dynamic/manuals/2011/chevrolet/Astra/pt/om_ng-chevrolet_Astra_my11-pt_BR.pdf',
    evidence: 'Seção 12, pp. 12-1 a 12-6: Hatchback e Sedan 2.0 Flexpower, câmbio manual e automático.',
    keys: ['23/4137/2011-5/004330-3', '23/3968/2011-5/004328-1', '23/3969/2011-5/004329-0', '23/4138/2011-5/004331-1'],
  },
  {
    title: 'Chevrolet Corsa 2010',
    external_url: 'https://meu.chevrolet.com.br/content/dam/gmownercenter/gmsa/gmbr/dynamic/manuals/2010/chevrolet/Corsa/pt/om_ng-chevrolet_Corsa_my10-pt_BR.pdf',
    evidence: 'Seção 12, p. 12-5: 1.4 Econo.Flex, Hatch e Sedan Maxx/Premium.',
    keys: ['23/4379/2010-5/004339-7', '23/4380/2010-5/004340-0', '23/4381/2010-5/004341-9', '23/4382/2010-5/004342-7'],
  },
  {
    title: 'Chevrolet Corsa 2012',
    external_url: 'https://www.chevrolet.com.br/content/dam/chevrolet/south-america/brazil/portuguese/index/services/owner-manuals/05-pdf/corsa/manual-corsa-2012.pdf',
    evidence: 'Seção 12, pp. 12-3 a 12-5: 1.4 Econo.Flex, Hatch Maxx, Sedan Maxx e Sedan Premium.',
    keys: ['23/4379/2012-5/004339-7', '23/4381/2012-5/004341-9', '23/4382/2012-5/004342-7'],
  },
  {
    title: 'Honda Civic 2020',
    external_url: 'https://www.honda.com.br/pos-venda/automoveis/sites/customer_service/files/2020-08/Civic%202020%20-%20Manual%20do%20propriet%C3%A1rio_20200805.pdf',
    evidence: 'Dados técnicos, pp. 7-2 e 7-4: sedã Touring 1.5 Turbo e sedãs LX, Sport, EX e EXL 2.0 Flex.',
    keys: ['25/8779/2020-5/014103-8', '25/7694/2020-5/014092-9', '25/7692/2020-5/014091-0', '25/7693/2020-5/014090-2', '25/7696/2020-1/014089-9'],
  },
  {
    title: 'Honda Fit 2012',
    external_url: 'https://www.honda.com.br/pos-venda/automoveis/sites/customer_service/files/2017-05/Fit%202012.pdf',
    evidence: 'Informações técnicas, p. 10-4: DX 1.339 cm³ e EXL 1.496 cm³ Flex. A tabela cobre transmissões manual e automática.',
    supporting_source: 'https://www.honda.com.br/pos-venda/automoveis/automovel/honda-fit-2012',
    keys: ['25/5468/2012-5/014070-8', '25/5469/2012-5/014069-4', '25/4800/2012-5/014057-0', '25/4799/2012-5/014056-2'],
  },
  {
    title: 'Honda Fit 2015',
    external_url: 'https://www.honda.com.br/pos-venda/automoveis/sites/customer_service/files/2017-05/Fit%202015%20-%20Propriet%C3%A1rio.pdf',
    evidence: 'Especificações, pp. 120 e 208: DX e LX 1.5 Flex com câmbio manual ou CVT e EXL 1.5 Flex CVT.',
    supporting_source: 'https://www.honda.com.br/pos-venda/automoveis/automovel/honda-fit-2015',
    keys: ['25/6779/2015-5/014082-1', '25/6780/2015-5/014083-0', '25/6781/2015-5/014081-3', '25/6782/2015-5/014080-5', '25/4799/2015-5/014056-2'],
  },
  {
    title: 'Honda Fit 2020',
    external_url: 'https://www.honda.com.br/pos-venda/automoveis/sites/customer_service/files/2020-08/Fit%202020%20-%20Manual%20do%20propriet%C3%A1rio_20200805.pdf',
    evidence: 'Informações gerais e capítulo 7: versões Fit 1.5 Flex com câmbio manual ou CVT. A homologação confirma DX manual, LX, EXL e Personal CVT.',
    supporting_source: 'https://www.honda.com.br/automoveis/sites/hab/files/2025-04/Tabela_de_Ru%C3%ADdo_parado_Portaria_85_4W_2025_03_31.pdf',
    keys: ['25/6780/2020-5/014083-0', '25/6781/2020-5/014081-3', '25/4799/2020-5/014056-2', '25/8050/2020-5/014097-0'],
  },
  {
    title: 'Renault Kwid 2023',
    external_url: 'https://cdn.group.renault.com/ren/br/renault-new-cars/editorial/2023/manuais/agosto/manual-proprietario-kwid-2023.pdf',
    evidence: 'Dados técnicos, p. 6.4: B4D 999 cm³. Etiqueta do Inmetro publicada pela marca: Zen, Intense e Outsider 1.0 12V Flex manual.',
    supporting_source: 'https://cdn.group.renault.com/ren/br/renault-new-cars/editorial/2023/selo-inmetro/maio/kwid/INMETRO-KWID-mar23.pdf',
    keys: ['48/8021/2023-5/025267-0', '48/8701/2023-5/025279-4', '48/8023/2023-5/025266-2'],
  },
  {
    title: 'Renault Kwid 2024',
    external_url: 'https://cdn.group.renault.com/ren/br/renault-new-cars/editorial/2024/manual/kwid/novembro/Manual-kwid-Nov24.pdf',
    evidence: 'Dados técnicos, p. 172: B4D 999 cm³. Etiqueta do Inmetro publicada pela marca: Zen, Intense e Outsider 1.0 12V Flex manual.',
    supporting_source: 'https://cdn.group.renault.com/ren/br/renault-new-cars/editorial/2024/etiqueta-inmetro/fevereiro/Kwid-Outsider-2024.pdf',
    keys: ['48/8021/2024-5/025267-0', '48/8701/2024-5/025279-4', '48/8023/2024-5/025266-2'],
  },
  {
    title: 'Renault Duster 2023',
    external_url: 'https://cdn.group.renault.com/ren/br/renault-new-cars/editorial/2023/manuais/agosto/manual-proprietario-duster-2023.pdf',
    evidence: 'Pp. 2.32 e 6.6: H4M 1.6 e H5H 1.3 TCe Flex. Relatório de sustentabilidade, p. 97, identifica as versões e os câmbios.',
    supporting_source: 'https://cdn.group.renault.com/ren/br/renault-new-cars/editorial/2024/sustentabilidade/Relatorio-de-Sustentablidade-2023.pdf.asset.pdf/c4c82854c6.pdf',
    keys: [
      '48/9738/2023-5/025310-3', '48/9061/2023-5/025300-6', '48/9062/2023-5/025301-4',
      '48/10100/2023-5/025319-7', '48/9063/2023-5/025302-2', '48/9064/2023-5/025303-0',
    ],
  },
  {
    title: 'Renault Oroch 2023',
    external_url: 'https://cdn.group.renault.com/ren/br/renault-new-cars/editorial/2023/manuais/agosto/manual-proprietario-oroch-2023.pdf',
    evidence: 'Pp. 2.33 e 6.6: H4M 1.6 e H5H 1.3 TCe Flex. Relatório de sustentabilidade, p. 97, identifica Intense e Pro 1.6 manual e Outsider 1.3 CVT.',
    supporting_source: 'https://cdn.group.renault.com/ren/br/renault-new-cars/editorial/2024/sustentabilidade/Relatorio-de-Sustentablidade-2023.pdf.asset.pdf/c4c82854c6.pdf',
    keys: ['48/9869/2023-5/025312-0', '48/10405/2023-5/025311-1', '48/9870/2023-5/025313-8'],
  },
  {
    title: 'Renault Logan, Sandero e Stepway 2023',
    external_url: 'https://cdn.group.renault.com/ren/br/renault-new-cars/editorial/2023/manuais/agosto/manual-proprietario-logan-sandero-stepway-2023.pdf',
    evidence: 'Pp. 2.29 e 6.3: Logan com B4D 1.0 Flex manual ou H4M 1.6 Flex CVT.',
    supporting_source: 'https://www.renault.com.br/manuais/logan.html',
    keys: ['48/8789/2023-5/025289-1', '48/8790/2023-5/025290-5', '48/8791/2023-5/025292-1'],
  },
  {
    title: 'Nissan Kicks 2017',
    external_url: 'https://www.nissan.com.br/content/dam/Nissan/br/PDF/2017/kicks/Manual%20do%20Propriet%C3%A1rio%20Kicks%2017MY_2.pdf',
    evidence: 'Capítulo 9, p. 9-6: 1.6 HR16DE. A edição de 2017 abrange a configuração CVT.',
    supporting_source: 'https://www.nissan.com.br/servicos/manuais/kicks.html',
    keys: ['43/7669/2017-5/023148-7', '43/7839/2017-5/023152-5', '43/7983/2017-5/023154-1', '43/7670/2017-5/023149-5'],
  },
  {
    title: 'Nissan Kicks 2018',
    external_url: 'https://www.nissan.com.br/content/dam/Nissan/br/site/servicos/manuais/kicks/2018/Manual_Proprietario_MP1P-P02F08%20(ok)%202018.pdf',
    evidence: 'Capítulo 9, p. 9-7: 1.6 Flex HR16DE. A edição de 2018 inclui câmbio manual e CVT.',
    supporting_source: 'https://www.nissan.com.br/servicos/manuais/kicks.html',
    keys: [
      '43/8020/2018-5/023156-8', '43/9594/2018-5/023158-4', '43/7982/2018-5/023155-0',
      '43/7983/2018-5/023154-1', '43/7670/2018-5/023149-5',
    ],
  },
  {
    title: 'Nissan Kicks 2019',
    external_url: 'https://www.nissan.com.br/content/dam/Nissan/br/site/servicos/manuais/kicks/2019/Manual%20do%20Propriet%C3%A1rio_MP1P-P02F09%20(ok)%202019.pdf',
    evidence: 'Capítulo 9, p. 9-7: 1.6 Flex HR16DE. A edição de 2019 inclui câmbio manual e CVT.',
    supporting_source: 'https://www.nissan.com.br/servicos/manuais/kicks.html',
    keys: [
      '43/8020/2019-5/023156-8', '43/9594/2019-5/023158-4', '43/7982/2019-5/023155-0',
      '43/7983/2019-5/023154-1', '43/7670/2019-5/023149-5', '43/8637/2019-5/023162-2',
    ],
  },
  {
    title: 'Nissan Kicks 2020',
    external_url: 'https://www.nissan.com.br/content/dam/Nissan/br/site/servicos/manuais/kicks/2020/MP_COMP_KICKS_(MY2020)_18%2009%202020%20(ok).pdf',
    evidence: 'Capítulo 9, p. 9-5: 1.6 Flex HR16DE, com câmbio manual ou CVT. A ficha da série Special Edition confirma as duas transmissões.',
    supporting_source: 'https://brazil.nissannews.com/pt-BR/releases/nissan-kicks-ganha-serie-especial-limitada',
    keys: [
      '43/8020/2020-5/023156-8', '43/9594/2020-5/023158-4', '43/7982/2020-5/023155-0',
      '43/7983/2020-5/023154-1', '43/7670/2020-5/023149-5', '43/8637/2020-5/023162-2',
      '43/8927/2020-5/023166-5', '43/8867/2020-5/023165-7',
    ],
  },
  {
    title: 'Nissan Kicks 2022',
    external_url: 'https://www.nissan.com.br/content/dam/Nissan/br/site/servicos/manuais/kicks/manual_proprietario_kicks_2022.pdf',
    evidence: 'Capítulo 9, pp. 9-5 a 9-6: 1.6 Flex HR16DE Sense manual e CVT, Advance CVT e Exclusive CVT.',
    supporting_source: 'https://www.nissan.com.br/servicos/manuais/kicks.html',
    keys: ['43/9338/2022-5/023179-7', '43/9337/2022-5/023178-9', '43/9335/2022-5/023180-0', '43/9336/2022-5/023181-9'],
  },
  {
    title: 'Nissan Kicks 2023',
    external_url: 'https://www.nissan.com.br/content/dam/Nissan/br/site/servicos/manuais/kicks/2023/MP_COMP_KICKS_MY23%20%20JANEIRO%2023%20indb%20-%20(COM%20X-PLAY2).pdf',
    evidence: 'Capítulo 9, pp. 9-5 a 9-6: 1.6 Flex HR16DE Sense CVT, Advance CVT e Exclusive CVT.',
    supporting_source: 'https://www.nissan.com.br/servicos/manuais/kicks.html',
    keys: ['43/9337/2023-5/023178-9', '43/9335/2023-5/023180-0', '43/9336/2023-5/023181-9'],
  },
  {
    title: 'Nissan Kicks 2026',
    external_url: 'https://www.nissan.com.br/content/dam/Nissan/br/site/servicos/manuais/kicks/2026/Manual_de_Propriet%C3%A1rio_-_Kicks_2026_v3.pdf',
    evidence: 'Capítulos 8 e 9, pp. 8-11 e 9-5: 1.0 Turbo Flex HR10DDT DCT. A ficha de lançamento confirma Sense, Advance, Exclusive e Platinum.',
    supporting_source: 'https://brazil.nissannews.com/pt-BR/releases/novo-nissan-kicks-chega-com-personalidade-e-atitude-para-redefinir-os-padroes-dos-suvs',
    keys: ['43/11502/2026-5/023194-0', '43/11499/2026-5/023195-9', '43/11799/2026-5/023196-7', '43/11501/2026-5/023197-5'],
  },
  {
    title: 'Nissan Versa V-Drive 2021',
    external_url: 'https://www.nissan.com.br/content/dam/Nissan/br/manuais/2020/MP_COMP_VERSAVDRIVE_19%2005%202020_C%20(22Mb)_novo%20layout.pdf',
    evidence: 'Capítulo 9: motor 1.0 HR10DE manual e 1.6 HR16DE manual ou CVT. Nissan publicou o manual na estreia da linha 2021 em 2020.',
    supporting_source: 'https://www.nissan.com.br/servicos/manuais/v-drive.html',
    keys: [
      '43/9168/2021-5/023169-0', '43/9169/2021-5/023170-3', '43/9170/2021-5/023168-1',
      '43/9171/2021-5/023171-1', '43/9172/2021-5/023172-0',
    ],
  },
  {
    title: 'Peugeot 2008 2024',
    external_url: 'https://carros.peugeot.com.br/content/dam/peugeot/brazil/b2c/owners/maintain-your-car/manuais/2024/Peugeot.2008-MV.2023.pdf',
    evidence: 'P. 149: 1.6 16V Flex AT6 e 1.6 THP Flex AT6. Os PDFs oficiais para 2023/2024 e 2024/2024 são idênticos. A ficha de lançamento confirma os quatro acabamentos.',
    supporting_source: 'https://www.media.stellantis.com/br-pt/peugeot/press/novidades-para-linha-2024-do-peugeot-2008',
    keys: ['44/7201/2024-5/024211-0', '44/10362/2024-5/024270-5', '44/9889/2024-5/024266-7', '44/8928/2024-5/024246-2'],
  },
  {
    title: 'Hyundai i20 2027',
    external_url: 'https://www.hyundai.com.br/content/dam/hmb/download-manuais/i20/Manual_i20.pdf',
    evidence: 'Motor, p. 10, e especificações de fluidos: 1.0 MPI Flex manual e 1.0 T-GDI Flex automático. O manual é publicado junto do catálogo 2026/2027.',
    supporting_source: 'https://www.hyundai.com.br/veiculos/novo-hyundai-i20.html',
    keys: [
      '26/12017/2027-5/015260-9', '26/12016/2027-5/015259-5', '26/12018/2027-5/015261-7',
      '26/12021/2027-5/015262-5', '26/12019/2027-5/015263-3', '26/12020/2027-5/015264-1',
    ],
  },
  {
    title: 'Hyundai HB20 e HB20S 2027',
    external_url: 'https://www.hyundai.com.br/content/dam/hmb/download-manuais/MP_HB20_A1SO-PB2603A_site.pdf',
    evidence: 'Lista de emissões e capítulo 2: hatch e sedã 1.0 MPI Flex manual e 1.0 TGDI Flex automático. As páginas oficiais vincularam o mesmo PDF aos catálogos 2027 de HB20 e HB20S.',
    supporting_source: 'https://www.hyundai.com.br/veiculos/novo-hyundai-hb20.html',
    keys: [
      '26/9906/2027-5/015215-3', '26/9909/2027-5/015213-7', '26/11458/2027-5/015251-0', '26/9617/2027-5/015209-9',
      '26/10012/2027-5/015218-8', '26/10014/2027-5/015219-6', '26/11459/2027-5/015252-8', '26/9621/2027-5/015206-4',
    ],
  },
  {
    title: 'Hyundai Kona Híbrido 2026',
    external_url: 'https://www.hyundai.com.br/content/dam/hmb/download-manuais/kona/manual_proprietario_kona_25_26.pdf',
    evidence: 'Capítulos 2 e 6: híbrido 1.6 GDI com DCT. A ficha da linha 2025/2026 confirma Ultimate e Signature.',
    supporting_source: 'https://www.hyundai.com.br/content/dam/hmb/cars/kona/2025-2026/download/Catalogo_Digital_Novo_Hyundai_KONA_Hibrido_2025.pdf',
    keys: ['26/11504/2026-6/015253-6', '26/11503/2026-6/015254-4'],
  },
  {
    title: 'Hyundai Palisade 2025 e 2026',
    external_url: 'https://www.hyundai.com.br/content/dam/hmb/download-manuais/MP_PALISADE_LX2_PE-2025-pt_BR-WEB.pdf',
    evidence: 'Capítulo 2: Signature 3.8 GDI automático AWD. A página da Hyundai oferece o mesmo manual para os catálogos 2024/2025 e 2025/2026.',
    supporting_source: 'https://www.hyundai.com.br/veiculos/palisade.html',
    keys: ['26/11194/2025-1/015248-0', '26/11194/2026-1/015248-0'],
  },
  {
    title: 'Hyundai Ioniq 5 2025',
    external_url: 'https://www.hyundai.com.br/content/dam/hmb/download-manuais/NE1-2025-pt_BR-WEB-2C.pdf',
    evidence: 'Capítulos 1 e 6: bateria e tração do Ioniq 5 NE1. A Hyundai Brasil disponibiliza esse manual para o Ioniq 5 Signature 84 kWh 2025.',
    supporting_source: 'https://www.hyundai.com.br/',
    keys: ['26/11227/2025-4/015250-1'],
  },
]

const manualsByFipeKey = new Map(ownerManuals.flatMap(({ keys, ...manual }) =>
  keys.map((key) => [key, manual])))

export function verifiedOwnerManual({ brand, model, year }, quote) {
  const modelYear = year?.split('-')[0]
  if (!modelYear || modelYear === '32000' || modelYear !== String(quote.modelYear)) return null
  return manualsByFipeKey.get([brand, model, year, quote.codeFipe].join('/')) ?? null
}
