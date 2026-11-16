# LembraCar

Reconstrução web responsiva da interface LembraCar a partir das 27 capturas em `public/references/`.

## Iniciar no computador

Com Docker Compose, execute `docker compose up -d --build` na pasta do projeto e abra `http://localhost:5173`. O Compose inicia o PostgreSQL 17 e mantém o banco no volume `catalog-data`.

Para rodar diretamente com Node.js 24, instale as dependências com `npm ci`, crie um banco PostgreSQL para o projeto e configure `DATABASE_URL` com a conexão. Em seguida, rode `npm run dev`. Os dados do perfil e do veículo ficam em `server/data/state.json`.

### Migrar um catálogo existente

Pare a versão antiga antes de iniciar a nova e preserve `server/data/catalog.sqlite` no diretório de dados. Na primeira inicialização de um banco PostgreSQL novo, o LembraCar importa automaticamente o catálogo, conserva os identificadores e completa os dados iniciais que estiverem faltando. O arquivo SQLite continua disponível como cópia de origem. O marcador de migração impede uma segunda importação no mesmo banco.

No Compose, a montagem de `server/data` já disponibiliza o arquivo antigo para a migração. Sem Docker, a variável `LEMBRACAR_DATA_DIR` pode apontar para o diretório que contém o SQLite e o arquivo de perfil. Para conferir a migração, consulte `/api/catalog/health` e verifique `storage: postgresql` e as contagens.

## Publicação em um servidor

Configure a conexão com um banco PostgreSQL dedicado usando `DATABASE_URL`, execute `npm run build` e depois `npm start` no servidor que hospeda o projeto. Defina `HOST` e `PORT` ao implantar. Por padrão, o serviço atende apenas em `127.0.0.1:5173`. Se usar Compose em um servidor, defina `POSTGRES_PASSWORD` com uma senha própria antes de criar o volume pela primeira vez.

## Catálogo automotivo

O PostgreSQL guarda marcas, modelos, gerações, motores, manuais, planos de manutenção por versão, problemas reportados, campanhas de recall, garantia, regras de atendimento em concessionária, contribuições da comunidade, revisão editorial e lotes de importação. O esquema exige fonte e estado de revisão para afirmações técnicas.

As 30 marcas iniciais são uma lista de cobertura do mercado brasileiro, não um ranking exato. A lista é vinculada ao portal de emplacamentos da [Fenabrave](https://www.fenabrave.org.br/portalv2/Conteudo/Emplacamentos), que deve ser consultado periodicamente para manter a cobertura do mercado. As fontes de recall registradas incluem o [dataset da Senatran](https://dados.transportes.gov.br/dataset/recall) e a [consulta oficial de recall](https://www.gov.br/pt-br/servicos/realizar-consulta-sobre-recall-de-veiculos?id=10560&origem=servico).

O catálogo inicial inclui 837 links de manuais oficiais, com 880 referências por modelo e ano. No painel **Catálogo**, busque a marca ou o modelo e expanda o resultado para ver os PDFs e as fontes. As referências seguem o ano indicado na fonte, quando disponível. Intervalos de manutenção e elegibilidade para revisão ou garantia dependem da versão e da confirmação da concessionária.

## API do catálogo

- `GET /api/catalog/health`: contagens por cobertura e estado.
- `GET /api/catalog/brands`: marcas e cobertura verificada.
- `GET /api/catalog/search?q=...`: modelos publicados e pesquisáveis.
- `GET /api/catalog/vehicles/:id`: modelo, agenda, problemas comprovados e mensagem de confirmação na concessionária.
- `GET /api/catalog/sources`: fontes cadastradas.
- `POST /api/catalog/contributions`: envia uma contribuição limitada para revisão; ela não é publicada automaticamente.

## Testes

Configure `LEMBRACAR_TEST_DATABASE_URL` com a conexão de um banco PostgreSQL de testes, usando uma conta que possa criar esquemas. Execute `npm test` para verificar a migração do SQLite, a cobertura das marcas, os filtros de publicação e as contribuições. A suíte cria e remove seus próprios esquemas. Execute `npm run build` para validar a interface de produção.

O cadastro e o Catálogo consultam a Tabela FIPE por marca, modelo e ano/combustível via [Fipe API](https://deividfortuna.github.io/fipe/v2/). A API local é `GET /api/fipe/cars`, com os parâmetros progressivos `brand`, `model` e `year`. Configure opcionalmente `LEMBRACAR_FIPE_TOKEN` no servidor para usar o token do provedor. A consulta por placa ainda não está disponível. O Copiloto organiza informações locais e orienta consultar uma fonte oficial quando ainda não existe cobertura técnica verificada.

### Testes no navegador

Com `LEMBRACAR_TEST_DATABASE_URL` configurada, execute `npx playwright install chromium` uma vez. Em seguida, execute `npm run build` e `npm run test:ui`. A suíte usa uma porta separada, um diretório temporário e um esquema PostgreSQL isolado. As respostas externas da FIPE são simuladas.
