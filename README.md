# LembraCar

Reconstrução web responsiva da interface LembraCar a partir das 27 capturas em `public/references/`.

## Iniciar no computador

1. Instale uma versão atual do Node.js.
2. Na pasta do projeto, execute `npm install` uma vez.
3. Execute `npm run dev` e abra `http://localhost:5173`.

O servidor local oferece a interface e uma API em `/api`. Os dados ficam em `server/data/state.json` no mesmo computador. Placa, veículo e registros não são enviados para um serviço externo.

## Publicação em um servidor

Execute `npm run build` e depois `npm start` no servidor que hospeda o projeto. Defina `HOST` e `PORT` ao implantar; por padrão, o serviço atende apenas em `127.0.0.1:5173`.

## Escopo atual

A busca de placa usa um resultado de demonstração. Não há conexão com uma base veicular, FIPE ou provedor de alertas. O Copiloto responde de forma local com base no fluxo e nos registros do protótipo.
