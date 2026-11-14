# LembraCar

Reconstrução web responsiva da interface LembraCar a partir das 27 capturas em `public/references/`.

## Iniciar no computador

1. Instale uma versão atual do Node.js.
2. Na pasta do projeto, execute `npm install` uma vez.
3. Execute `npm run dev` e abra `http://localhost:5173`.

O servidor local oferece a interface e uma API em `/api`. Os dados do perfil e do veículo ficam em `server/data/state.json`; o catálogo técnico usa PostgreSQL no Docker e SQLite quando `DATABASE_URL` não está definida. Os arquivos locais ficam neste computador e não são enviados para um serviço externo.

## Publicação em um servidor

Execute `npm run build` e depois `npm start` no servidor que hospeda o projeto. Defina `HOST` e `PORT` ao implantar; por padrão, o serviço atende apenas em `127.0.0.1:5173`.

## Catálogo automotivo

O catálogo tem estrutura para marcas, modelos, gerações, motores, manuais, planos de manutenção por versão, problemas reportados, campanhas de recall, garantia, regras de atendimento em concessionária, contribuições da comunidade, revisão editorial e lotes de importação. O desenho exige fonte e estado de revisão para afirmações técnicas. Conteúdo do usuário fica separado dos dados publicados.

As 30 marcas iniciais são uma lista de cobertura do mercado brasileiro, não um ranking exato. A lista é vinculada ao portal de emplacamentos da [Fenabrave](https://www.fenabrave.org.br/portalv2/Conteudo/Emplacamentos), que deve ser consultado periodicamente para manter a cobertura do mercado. As fontes de recall registradas incluem o [dataset da Senatran](https://dados.transportes.gov.br/dataset/recall) e a [consulta oficial de recall](https://www.gov.br/pt-br/servicos/realizar-consulta-sobre-recall-de-veiculos?id=10560&origem=servico).

O piloto em PostgreSQL inclui quatro versões e seus manuais de fábrica. As regras publicadas exigem evidência da versão aplicável. Elegibilidade para revisão ou garantia sempre requer confirmação da concessionária conforme a versão, o chassi e o histórico. Links de manuais são armazenados como referências, sem copiar o conteúdo protegido dos fabricantes.

## PostgreSQL no Docker

1. Execute `docker compose up -d --build`. O banco usa o volume `catalog-db` e o serviço Node recebe `DATABASE_URL` pelo Compose.
2. No primeiro início, a migração `001_catalog` cria o esquema e copia o catálogo SQLite existente, incluindo IDs e vínculos. Uma instalação nova recebe os dados iniciais. O arquivo SQLite e os registros pessoais continuam no disco local.
3. Execute `docker compose exec painel node server/db/import-pilot.js` para publicar o CSV revisado de Fiat e Volkswagen. O importador usa `COPY FROM STDIN` em tabela temporária, valida duplicatas e vínculos e publica em uma transação. Uma nova execução mantém os registros do piloto sem duplicá-los.
4. Abra o Catálogo para ver a cobertura e os links oficiais. O piloto inclui Palio Attractive 1.0 2016, Scudo Cargo 1.5 Diesel 2023, Gol Track 1.0 2015 e Polo Track 1.0 2025. O Palio tem uma regra revisada para troca de óleo. Nenhum dos quatro tem plano completo revisado.

A senha padrão do Compose serve para uso local. Para definir outra antes de inicializar o volume, use `CATALOG_DB_PASSWORD` com caracteres alfanuméricos e hífens. A porta do banco fica na rede interna do Compose.

## API do catálogo

- `GET /api/catalog/health`: contagens por cobertura e estado.
- `GET /api/catalog/coverage`: cobertura por versão e ano, com manuais, regras e planos completos revisados.
- `GET /api/catalog/brands`: marcas e cobertura verificada.
- `GET /api/catalog/search?q=...`: modelos publicados e pesquisáveis.
- `GET /api/catalog/vehicles/:id`: modelo, agenda, problemas comprovados e mensagem de confirmação na concessionária.
- `GET /api/catalog/sources`: fontes cadastradas.
- `POST /api/catalog/contributions`: envia uma contribuição limitada para revisão; ela não é publicada automaticamente.

## Testes

Execute `npm test` para verificar inicialização do banco, cobertura das 30 marcas, filtros de publicação, contribuição pendente e exigência de fonte. Execute `npm run build` para validar a interface de produção.

O cadastro e o Catálogo consultam a [Fipe API](https://deividfortuna.github.io/fipe/v2/) em quatro etapas. Ao selecionar o carro, `GET /api/fipe/cars?brand=…&family=…` lista seus anos-modelo registrados no Brasil. Após a escolha do ano, `GET /api/fipe/cars?brand=…&family=…&year=…` lista as versões disponíveis naquele ano. Ao selecionar a versão, `GET /api/fipe/cars?brand=…&model=…&year=…` consulta a cotação de referência atual. Na consulta de cotação, `year` inclui o identificador de combustível do provedor. Configure opcionalmente `LEMBRACAR_FIPE_TOKEN` no servidor para usar um token do provedor.

O arquivo `server/db/fipe-matches.js` registra as chaves exatas associadas a cada manual oficial e a evidência usada para verificar o vínculo. Para adicionar uma versão, confirme na documentação da montadora o ano-modelo e a configuração mecânica, confira se há edições diferentes por data de fabricação e valide os quatro componentes da chave na FIPE. Um PDF pode ter vários vínculos verificados. A consulta continua exibindo a cotação para as versões com manual pendente.

A consulta por placa ainda não está disponível. O Copiloto organiza informações locais e orienta consultar uma fonte oficial quando ainda não existe cobertura técnica verificada.

### Testes no navegador

Execute `npx playwright install chromium` uma vez. Em seguida, execute `npm run build` e `npm run test:ui`. A suíte abre a versão de produção em uma porta separada, usa um diretório temporário para os registros e simula as respostas externas da FIPE.
