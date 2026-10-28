# Consulta Certa

Sistema web para reduzir faltas em consultas de Unidades Básicas de Saúde (UBS), liberar vagas e facilitar o acesso de quem está na fila de espera.

> **Autor:** `<João>` · **Turma/Curso:** `<2 ano>` · **Projeto Web**

## Problema e solução

Quando uma pessoa falta a uma consulta sem avisar, o horário fica vazio e outra pessoa continua esperando. Um estudo em uma UBS do sul do Brasil encontrou 19,2% de faltas (598 em 3.131 consultas). A situação afeta pacientes, profissionais e a gestão da saúde.

O Consulta Certa permite consultar horários, agendar, confirmar ou cancelar consultas. Quando uma vaga é liberada, o sistema a atribui ao primeiro paciente aguardando naquela especialidade. A recepção registra comparecimento ou falta, e o administrador consulta a taxa de absenteísmo.

Fonte: SILVEIRA, G. S. et al. *Prevalência de absenteísmo em consultas médicas em unidade básica de saúde do sul do Brasil*. Rev Bras Med Fam Comunidade, 13(40):1-7, 2018. <https://rbmfc.org.br/rbmfc/article/download/1836/954/>

## Perfis e funcionalidades

- **Paciente:** cria conta, consulta horários, agenda, remarca, confirma e cancela suas consultas, entra ou sai da fila e acompanha o histórico.
- **Atendente:** consulta a agenda da unidade, agenda em nome de um paciente, gerencia a fila e registra comparecimento ou falta.
- **Administrador:** faz as ações de atendente, gerencia perfis, unidades, especialidades, profissionais e horários, e consulta relatórios.

As permissões são verificadas pela API. O paciente só consulta e altera seus próprios agendamentos. As senhas são protegidas com bcrypt e as rotas protegidas usam JWT.

## Fluxo e regras de negócio

1. O paciente cria uma conta e entra no sistema.
2. Escolhe uma especialidade e busca horários livres.
3. Agenda uma vaga. A API bloqueia o horário dentro de uma transação para impedir reservas simultâneas.
4. O paciente confirma até duas horas antes. O sistema verifica periodicamente consultas não confirmadas e cancela as vencidas.
5. Ao cancelar ou expirar uma consulta, o horário fica livre e é atribuído à pessoa mais antiga na fila daquela especialidade.
6. A recepção registra compareceu ou faltou depois do horário da consulta.
7. O administrador consulta o relatório de faltas por período e especialidade.

A oferta de vaga aparece como novo agendamento no painel do paciente quando ele entrar no sistema. O protótipo não envia e-mail nem SMS.

## Tecnologias e organização

- Front-end: HTML, CSS e JavaScript puro, DOM e Fetch.
- Back-end: Node.js, Express e API REST.
- Banco: MySQL pelo pacote `mysql2`.
- Segurança: `bcrypt`, `jsonwebtoken`, `dotenv` e autorização por perfil.

```text
consulta-certa/
├── backend/
│   ├── controllers/       # lógica e regras de negócio
│   ├── database/          # pool MySQL e transações
│   ├── middlewares/       # autenticação, autorização e erros
│   ├── routes/            # endpoints da API
│   ├── scripts/           # criação do admin e horários de demonstração
│   ├── services/          # liberação e atribuição de vagas
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── css/               # estilos responsivos
│   ├── js/                # formulários e chamadas Fetch
│   ├── assets/
│   ├── index.html         # acesso com abas
│   ├── login.html
│   ├── cadastro.html
│   └── painel.html        # telas por perfil
├── sql/consulta_certa.sql
├── docs/roteiro-apresentacao.md
├── .gitignore
└── README.md
```

## Banco de dados

```text
perfis 1 ── N usuarios
unidades 1 ── N profissionais N ── 1 especialidades
profissionais 1 ── N horarios 1 ── N consultas N ── 1 usuarios (pacientes)
usuarios (pacientes) 1 ── N fila_espera N ── 1 especialidades
fila_espera 0..1 ── 1 consultas (vaga atribuída)
```

O script cria as tabelas, chaves estrangeiras, perfis, duas especialidades, uma unidade e dois profissionais de demonstração. O administrador de teste é criado pelo script `seed:admin`, com dados fornecidos localmente no `.env`.

## Como instalar e executar

Requisitos: Node.js, npm e servidor MySQL local. No terminal, dentro do projeto:

1. Crie o banco executando `sql/consulta_certa.sql` no MySQL Workbench ou no cliente MySQL. O script cria o banco `consulta_certa`.
2. Copie `backend/.env.example` para `backend/.env` e preencha os dados do MySQL. Troque `JWT_SECRET` por uma chave aleatória com pelo menos 32 caracteres e defina `ADMIN_SENHA` com pelo menos 12 caracteres. Para uma conta de paciente com dois atendimentos fictícios para o relatório, troque também `DEMO_PACIENTE_EMAIL` e `DEMO_PACIENTE_SENHA` (mínimo 12 caracteres). Não envie `.env` ao GitHub.
3. Instale os pacotes e crie o administrador:

   ```powershell
   cd backend
   npm install
   npm run seed:admin
   npm run seed:demo
   npm run dev
   ```

4. Abra <http://localhost:3000>. A rota <http://localhost:3000/api/saude> deve responder `{"status":"ok","banco":"conectado"}`.
5. Entre como administrador usando o e-mail e a senha definidos no `.env`. Se configurou a conta demo, entre como paciente usando `DEMO_PACIENTE_EMAIL` e `DEMO_PACIENTE_SENHA`; o histórico fictício permite demonstrar o relatório. Também pode cadastrar outro paciente pela tela de cadastro. Depois de alterar um perfil no painel, saia e entre novamente para receber um JWT com o novo perfil.

`seed:demo` cria horários livres para os próximos dias. Se as variáveis da conta demo estiverem configuradas, ele também cria uma conta paciente e dois atendimentos fictícios (um comparecimento e uma falta) para ilustrar o relatório. Use esses dados somente em um banco local de apresentação. Não há credenciais padrão no código: as contas usam os valores definidos no `.env`.

### Verificação manual para apresentação

- Crie um paciente, entre como ele e procure uma especialidade com horários livres.
- Agende, confirme, remarque e cancele uma consulta. Se houver alguém na fila da especialidade, o sistema atribui a vaga liberada a essa pessoa.
- Entre com um usuário atendente e abra a agenda da data da consulta para registrar compareceu/faltou após o horário.
- Entre como admin e mostre a gestão de usuários, cadastros, horários e relatório. Com a conta demo configurada, o relatório inclui dois registros fictícios; sem esses dados, fica vazio até haver consultas concluídas.
- Para demonstrar autorização, entre como paciente, abra o console do navegador e execute: `fetch('/api/exemplo/admin', { headers: { Authorization: 'Bearer ' + localStorage.getItem('consultaCertaToken') } }).then(r => r.status)`; a API deve responder `403`.
## Rotas principais

| Método | Rota | Acesso | Ação |
|---|---|---|---|
| GET | `/api/saude` | Público | Verifica API e banco |
| POST | `/api/auth/cadastro` | Público | Cria conta paciente |
| POST | `/api/auth/login` | Público | Gera JWT |
| GET | `/api/auth/perfil` | Autenticado | Consulta usuário atual |
| GET | `/api/especialidades` | Público | Lista especialidades ativas |
| GET/POST/PUT/DELETE | `/api/horarios` | Consulta público; alterações atendente/admin | Agenda e CRUD de horários |
| GET | `/api/horarios/agenda` | Atendente/admin | Agenda da unidade |
| GET/POST/PUT/DELETE | `/api/consultas` | Autenticado | Consulta e CRUD de agendamentos; DELETE cancela preservando histórico |
| PUT | `/api/consultas/:id/resultado` | Atendente/admin | Registra compareceu/faltou |
| GET/POST/DELETE | `/api/fila-espera` | Autenticado | Consulta, entra e sai da fila |
| GET/POST | `/api/admin/unidades`, `/especialidades`, `/profissionais` | Admin | Lista e cria cadastros da unidade |
| PUT/DELETE | `/api/admin/:recurso/:id` | Admin | Atualiza e exclui unidade, especialidade ou profissional |
| GET | `/api/admin/usuarios` | Admin | Lista usuários |
| PUT | `/api/admin/usuarios/:id/perfil` | Admin | Altera perfil |
| GET | `/api/relatorios/absenteismo?de=AAAA-MM-DD&ate=AAAA-MM-DD` | Admin | Taxa de faltas por especialidade |

Para horários, consultas e fila, os métodos de leitura e alteração detalhados dependem do caminho e do perfil. O código de rotas é a referência de cada endpoint.

## Segurança e Git

- `.env`, `node_modules/`, chaves privadas e logs estão no `.gitignore`.
- A API usa parâmetros SQL (`?`) para os valores recebidos e valida o perfil antes de executar operações administrativas.
- O mesmo repositório GitHub é usado para as quatro entregas. Commits devem descrever cada bloco de trabalho. Não faça push até revisar o conteúdo e decidir enviá-lo.
- O front-end é servido pelo próprio Express, evitando configuração de servidor separado.

## Apresentação

O roteiro com a ordem da demonstração e dez perguntas prováveis está em [`docs/roteiro-apresentacao.md`](docs/roteiro-apresentacao.md).