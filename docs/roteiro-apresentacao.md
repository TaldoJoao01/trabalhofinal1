# Roteiro de apresentação — Consulta Certa

## Demonstração sugerida

1. **Problema e solução:** explique como uma falta deixa a vaga ociosa e como a fila ajuda a reaproveitá-la.
2. **Perfis:** mostre paciente, atendente e administrador, destacando o que cada um pode fazer.
3. **Banco e arquitetura:** mostre as tabelas no MySQL e a separação entre `routes`, `controllers`, `middlewares` e `database`.
4. **Autenticação:** cadastre um paciente, faça login e explique que a API entrega um JWT; mostre a senha protegida com bcrypt no banco.
5. **Permissões:** use um paciente para abrir rota de admin e mostre que a API responde 403.
6. **CRUD e regras:** agende, confirme e cancele uma consulta; mostre que horário ocupado não pode ser reservado novamente.
7. **Fila:** entre na fila, cancele uma consulta e explique a atribuição ao primeiro paciente da mesma especialidade.
8. **Atendimento e relatório:** como atendente, registre compareceu/faltou; como admin, consulte a taxa no período.

## Explicação do caminho de uma requisição

Exemplo de cancelamento: o paciente clica em **Cancelar** no `painel.html`; `painel.js` envia `DELETE /api/consultas/:id` com o JWT; `consultasRoutes.js` exige autenticação; `consultasController.js` verifica se a consulta pertence ao paciente; `transacao.js` abre uma transação; o controller marca a consulta cancelada, libera o horário e chama `agendaService.js` para atribuí-lo ao primeiro da fila; o Express devolve JSON para a interface atualizar a tela.

## Perguntas prováveis

1. **Qual problema o sistema resolve?** Reduz desperdício de vagas causado por faltas e organiza a fila de espera.
2. **Como o paciente recebe acesso?** Ele se cadastra; o back-end sempre cria o perfil `paciente`.
3. **Como as senhas ficam protegidas?** O sistema salva somente o hash feito com bcrypt, nunca a senha em texto.
4. **O que é o JWT?** Um token assinado usado para identificar o usuário nas próximas chamadas à API.
5. **Onde as permissões são verificadas?** Nos middlewares e nos controllers da API, além da interface.
6. **Como evitamos duas reservas para a mesma vaga?** A API bloqueia a linha do horário em uma transação e confere o status antes de agendar.
7. **O que acontece no cancelamento?** A consulta fica no histórico como cancelada, o horário é liberado e oferecido à fila.
8. **Como funciona a confirmação?** O paciente confirma até duas horas antes; consultas que vencem sem confirmação são processadas periodicamente.
9. **Como a taxa de faltas é calculada?** Faltas divididas pelo total de consultas com resultado compareceu ou faltou, multiplicado por 100.
10. **Como o front-end conversa com a API?** JavaScript usa Fetch para enviar e receber JSON e atualiza a página pelo DOM.