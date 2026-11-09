# LembraCar

Reconstrução web responsiva da interface LembraCar a partir das 27 capturas em `public/references/`.

## Iniciar no computador

1. Instale uma versão atual do Node.js.
2. Na pasta do projeto, execute `npm install` uma vez.
3. Execute `npm run dev` e abra `http://localhost:5173`.

O servidor local oferece a interface e uma API em `/api`. Os dados do perfil e do veículo ficam em `server/data/state.json`; o catálogo técnico fica em `server/data/catalog.sqlite`. Os arquivos locais ficam neste computador e não são enviados para um serviço externo.

## Publicação em um servidor

Execute `npm run build` e depois `npm start` no servidor que hospeda o projeto. Defina `HOST` e `PORT` ao implantar; por padrão, o serviço atende apenas em `127.0.0.1:5173`.

## Catálogo automotivo

O SQLite tem estrutura para marcas, modelos, gerações, motores, manuais, planos de manutenção por versão, problemas reportados, campanhas de recall, garantia, regras de atendimento em concessionária, contribuições da comunidade, revisão editorial e lotes de importação. O desenho exige fonte e estado de revisão para afirmações técnicas. Conteúdo do usuário fica separado dos dados publicados.

As 30 marcas iniciais são uma lista de cobertura do mercado brasileiro, não um ranking exato. A lista é vinculada ao portal de emplacamentos da [Fenabrave](https://www.fenabrave.org.br/portalv2/Conteudo/Emplacamentos), que deve ser consultado periodicamente para manter a cobertura do mercado. As fontes de recall registradas incluem o [dataset da Senatran](https://dados.transportes.gov.br/dataset/recall) e a [consulta oficial de recall](https://www.gov.br/pt-br/servicos/realizar-consulta-sobre-recall-de-veiculos?id=10560&origem=servico).

Esta entrega prepara a arquitetura e inicia a lista de marcas e itens de manutenção. Ela não inclui ainda manuais nem fatos técnicos específicos por modelo; o painel informa esses zeros em vez de deduzir intervalos ou defeitos. Elegibilidade para revisão ou garantia sempre requer confirmação da concessionária conforme a versão, o chassi e o histórico. Links de manuais são armazenados como referências, sem copiar o conteúdo protegido dos fabricantes.

## API do catálogo

- `GET /api/catalog/health`: contagens por cobertura e estado.
- `GET /api/catalog/brands`: marcas e cobertura verificada.
- `GET /api/catalog/search?q=...`: modelos publicados e pesquisáveis.
- `GET /api/catalog/vehicles/:id`: modelo, agenda, problemas comprovados e mensagem de confirmação na concessionária.
- `GET /api/catalog/sources`: fontes cadastradas.
- `POST /api/catalog/contributions`: envia uma contribuição limitada para revisão; ela não é publicada automaticamente.

## Testes

Execute `npm test` para verificar inicialização do banco, cobertura das 30 marcas, filtros de publicação, contribuição pendente e exigência de fonte. Execute `npm run build` para validar a interface de produção.

O cadastro e o Catálogo consultam a Tabela FIPE por marca, modelo e ano/combustível via [Fipe API](https://deividfortuna.github.io/fipe/v2/). A API local é `GET /api/fipe/cars`, com os parâmetros progressivos `brand`, `model` e `year`. Configure opcionalmente `LEMBRACAR_FIPE_TOKEN` no servidor para usar o token do provedor. A consulta por placa ainda não está disponível. O Copiloto organiza informações locais e orienta consultar uma fonte oficial quando ainda não existe cobertura técnica verificada.

### Testes no navegador

Execute `npx playwright install chromium` uma vez. Em seguida, execute `npm run build` e `npm run test:ui`. A suíte abre a versão de produção em uma porta separada, usa um diretório temporário para os registros e simula as respostas externas da FIPE.
