# Consulta Certa

Sistema web para **reduzir faltas (absenteísmo) em consultas médicas da atenção básica**, organizando agendamentos, confirmações e o reaproveitamento de vagas liberadas.

> Projeto Web — Entrega 1 (Problema e estrutura inicial)
> **Autor:** `<João>` · **Turma/Curso:** `<2 ano>` · **Entrega:** 30/10/2026

---

## 1. O problema

### Contexto
Nas Unidades Básicas de Saúde (UBS), as consultas são agendadas com dias ou semanas de antecedência. Muitos pacientes marcam e simplesmente não comparecem, e a unidade quase nunca fica sabendo a tempo de oferecer o horário a outra pessoa. A agenda, em geral, é controlada em papel, planilhas ou mensagens de WhatsApp, sem confirmação de presença e sem fila de espera organizada.

### Dimensão do problema (dado real)
Um estudo em uma UBS do sul do Brasil encontrou **19,2% de faltas** (598 faltas em 3.131 consultas médicas agendadas), com taxas mensais variando de 14,4% a 26%. Os próprios autores apontam como possíveis fatores o longo intervalo entre a marcação e o atendimento e a ausência de triagem da demanda.

Fonte: SILVEIRA, G. S. et al. *Prevalência de absenteísmo em consultas médicas em unidade básica de saúde do sul do Brasil*. Rev Bras Med Fam Comunidade, 13(40):1-7, 2018. <https://rbmfc.org.br/rbmfc/article/download/1836/954/>

### Quem é afetado
- **Pacientes** que esperam semanas por uma vaga que, no fim, fica ociosa porque outra pessoa faltou.
- **Profissionais e equipe da UBS**, que têm horários vazios e perdem produtividade.
- **Gestão municipal de saúde**, que arca com o custo de uma estrutura subutilizada enquanto a fila de espera cresce.

### Justificativa
Cada consulta perdida é uma vaga que poderia ter atendido outra pessoa. Reduzir as faltas e reaproveitar os horários liberados aumenta o acesso ao atendimento sem exigir mais médicos nem mais estrutura física. Um sistema simples, que confirma presença e libera vagas com antecedência, ataca diretamente a causa do desperdício.

---

## 2. Proposta de solução

Uma aplicação web em que o paciente agenda, **confirma ou cancela** sua consulta, e a equipe da unidade acompanha a agenda e as faltas. Quando um paciente cancela ou não confirma a tempo, a vaga é liberada e **oferecida a quem está na fila de espera**.

### Objetivos
- Reduzir o número de faltas por meio de confirmação obrigatória de presença antes da consulta.
- Reaproveitar vagas liberadas com uma fila de espera por especialidade.
- Dar à recepção e à gestão uma visão clara da agenda e do histórico de faltas.
- Substituir o controle em papel/planilha por um registro único e confiável.

---

## 3. Funcionalidades previstas

**Contas e acesso**
- Cadastro e login de usuários (senha protegida, autenticação via JWT).
- Níveis de acesso por perfil.

**Agendamento**
- Consulta de especialidades, profissionais e horários disponíveis.
- Agendamento, remarcação e cancelamento de consultas.
- Confirmação de presença dentro de um prazo antes da consulta.

**Fila de espera e vagas**
- Entrada na fila de espera de uma especialidade.
- Liberação automática da vaga quando há cancelamento ou falta de confirmação, oferecendo-a ao próximo da fila.

**Acompanhamento e gestão**
- Registro de comparecimento (compareceu / faltou).
- Histórico de consultas e faltas por paciente.
- Relatório com taxa de absenteísmo por período e por especialidade.
- CRUD de unidades, especialidades e horários (administração).

---

## 4. Tipos de usuário e ações

| Perfil | O que pode fazer |
|---|---|
| **Paciente** | Cadastrar-se e fazer login; ver horários disponíveis; agendar, remarcar, confirmar e cancelar **suas** consultas; entrar na fila de espera; ver seu histórico. |
| **Atendente (recepção)** | Ver a agenda da unidade; agendar e cancelar consultas em nome de pacientes; registrar comparecimento ou falta; gerenciar a fila de espera. |
| **Administrador (gestor)** | Tudo o que o atendente faz, além de gerenciar usuários e perfis, unidades, especialidades e profissionais, e ver os relatórios de absenteísmo. |

As permissões serão verificadas **na API** (middleware de autorização), e não apenas escondidas na interface.

---

## 5. Fluxo básico de funcionamento

1. O paciente se cadastra e faz login (recebe um token JWT).
2. Escolhe uma especialidade e vê os horários livres.
3. Agenda a consulta. Se não houver horário, entra na **fila de espera**.
4. Perto da data da consulta, o sistema pede a **confirmação de presença** dentro de um prazo.
5. **Confirmou:** a consulta segue mantida.
   **Cancelou ou não confirmou no prazo:** a consulta é cancelada e a vaga é liberada.
6. A vaga liberada é oferecida ao primeiro paciente da fila de espera daquela especialidade.
7. No dia, a recepção registra se o paciente **compareceu** ou **faltou**.
8. O gestor consulta os relatórios com a taxa de faltas.

```
Paciente ──> Agenda consulta ──> Confirma presença? ──sim──> Consulta mantida ──> Compareceu / Faltou
                  │                      │
          sem vaga│                      │não / prazo vencido
                  ▼                      ▼
           Fila de espera <──── Vaga liberada (cancelamento)
```

---

## 6. Tecnologias

- **Front-end:** HTML, CSS e JavaScript (manipulação do DOM e Fetch)
- **Back-end:** Node.js e Express (API REST)
- **Banco de dados:** MySQL
- **Autenticação:** JWT, com senhas criptografadas

---

## 7. Estrutura do projeto

```
consulta-certa/
├── backend/
│   ├── routes/          # endpoints da API
│   ├── controllers/     # regras de negócio
│   ├── middlewares/     # autenticação (JWT), autorização, erros
│   ├── database/        # conexão com o MySQL
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── css/
│   ├── js/
│   ├── assets/
│   └── index.html
├── sql/                 # script do banco (Entrega 2)
├── docs/
├── .gitignore
└── README.md
```

---

## 8. Modelo de dados planejado (a implementar na Entrega 2)

| Tabela | Finalidade | Relacionamentos |
|---|---|---|
| `usuarios` | Pacientes, atendentes e administradores | possui um `perfil` |
| `unidades` | Unidades de saúde | — |
| `especialidades` | Clínica geral, pediatria etc. | — |
| `profissionais` | Médicos e seus vínculos | unidade, especialidade |
| `horarios` | Vagas disponíveis na agenda | profissional |
| `consultas` | Agendamentos e seu status (agendada, confirmada, cancelada, compareceu, faltou) | paciente, horário |
| `fila_espera` | Pacientes aguardando vaga | paciente, especialidade |

---

## 9. Cronograma das entregas

| Entrega | Foco | Status |
|---|---|---|
| 1 | Problema, proposta e estrutura inicial | ✅ Esta entrega |
| 2 | Banco de dados, cadastro, login e JWT | ⬜ |
| 3 | CRUD completo, integração e permissões | ⬜ |
| 4 | Projeto completo, documentação e apresentação | ⬜ |

---

## 10. Como executar

A instalação e a execução serão documentadas conforme o projeto evoluir (README final na Entrega 4). Já existe um modelo de variáveis de ambiente em `backend/.env.example`; o arquivo `.env` real **não** deve ser enviado ao GitHub.

