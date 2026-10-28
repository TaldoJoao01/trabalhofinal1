const transacao = require('../database/transacao');

async function atribuirProximoDaFila(conexao, horarioId) {
  const [horarios] = await conexao.execute(
    `SELECT h.id, h.inicio, p.especialidade_id
     FROM horarios h JOIN profissionais p ON p.id = h.profissional_id
     WHERE h.id = ? FOR UPDATE`, [horarioId],
  );
  if (!horarios.length) return null;
  const horario = horarios[0];
  const [elegiveis] = await conexao.execute(
    'SELECT TIMESTAMPDIFF(MINUTE, NOW(), ?) AS minutos_restantes', [horario.inicio],
  );
  if (elegiveis[0].minutos_restantes <= 120) return null;

  const [fila] = await conexao.execute(
    `SELECT id, paciente_id FROM fila_espera
     WHERE especialidade_id = ? AND status = 'aguardando'
     ORDER BY criado_em ASC, id ASC LIMIT 1 FOR UPDATE`, [horario.especialidade_id],
  );
  if (!fila.length) return null;

  const [resultado] = await conexao.execute(
    `INSERT INTO consultas (paciente_id, horario_id, status, confirmar_ate)
     VALUES (?, ?, 'agendada', DATE_SUB(?, INTERVAL 2 HOUR))`,
    [fila[0].paciente_id, horarioId, horario.inicio],
  );
  await conexao.execute('UPDATE horarios SET status = \'ocupado\' WHERE id = ?', [horarioId]);
  await conexao.execute(
    `UPDATE fila_espera SET status = 'agendada', consulta_id = ? WHERE id = ?`,
    [resultado.insertId, fila[0].id],
  );
  return { paciente_id: fila[0].paciente_id, consulta_id: resultado.insertId };
}

async function encerrarConsulta(consultaId) {
  return transacao(async (conexao) => {
    const [consultas] = await conexao.execute(
      `SELECT c.id, c.horario_id, c.status FROM consultas c WHERE c.id = ? FOR UPDATE`, [consultaId],
    );
    if (!consultas.length) return null;
    const consulta = consultas[0];
    if (!['agendada', 'confirmada'].includes(consulta.status)) return null;
    await conexao.execute("UPDATE consultas SET status = 'cancelada' WHERE id = ?", [consultaId]);
    await conexao.execute("UPDATE fila_espera SET status = 'cancelada' WHERE consulta_id = ? AND status = 'agendada'", [consultaId]);
    await conexao.execute("UPDATE horarios SET status = 'livre' WHERE id = ?", [consulta.horario_id]);
    const proximo = await atribuirProximoDaFila(conexao, consulta.horario_id);
    return { horario_id: consulta.horario_id, proximo };
  });
}

module.exports = { atribuirProximoDaFila, encerrarConsulta, transacao };