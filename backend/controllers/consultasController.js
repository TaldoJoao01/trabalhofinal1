const pool = require('../database/conexao');
const transacao = require('../database/transacao');
const { atribuirProximoDaFila } = require('../services/agendaService');

function erro(status, mensagem) { const e = new Error(mensagem); e.status = status; return e; }
function inteiro(valor) { const n = Number(valor); return Number.isInteger(n) && n > 0 ? n : null; }
const equipe = (perfil) => ['atendente', 'admin'].includes(perfil);

async function listar(req, res, next) {
  try {
    const filtros = []; const valores = [];
    if (req.usuario.perfil === 'paciente') { filtros.push('c.paciente_id = ?'); valores.push(req.usuario.id); }
    if (req.query.data) { filtros.push('DATE(h.inicio) = ?'); valores.push(req.query.data); }
    const [consultas] = await pool.execute(
      `SELECT c.id, c.status, c.confirmar_ate, c.criado_em, h.inicio,
              e.id AS especialidade_id, e.nome AS especialidade, p.nome AS profissional, u.nome AS unidade,
              paciente.id AS paciente_id, paciente.nome AS paciente
       FROM consultas c JOIN horarios h ON h.id = c.horario_id
       JOIN profissionais p ON p.id = h.profissional_id
       JOIN especialidades e ON e.id = p.especialidade_id
       JOIN unidades u ON u.id = p.unidade_id JOIN usuarios paciente ON paciente.id = c.paciente_id
       ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       ORDER BY h.inicio DESC LIMIT 300`, valores,
    );
    res.json(consultas);
  } catch (err) { next(err); }
}

async function agendar(req, res, next) {
  try {
    const horarioId = inteiro(req.body.horario_id);
    const pacienteId = equipe(req.usuario.perfil) && req.body.paciente_id ? inteiro(req.body.paciente_id) : req.usuario.id;
    if (!horarioId || !pacienteId) throw erro(400, 'Informe um horário válido.');
    const consulta = await transacao(async (conexao) => {
      const [pacientes] = await conexao.execute("SELECT u.id FROM usuarios u JOIN perfis p ON p.id = u.perfil_id WHERE u.id = ? AND u.ativo = TRUE AND p.nome = 'paciente'", [pacienteId]);
      if (!pacientes.length) throw erro(404, 'Paciente não encontrado.');
      const [horarios] = await conexao.execute('SELECT id, inicio, status FROM horarios WHERE id = ? FOR UPDATE', [horarioId]);
      if (!horarios.length) throw erro(404, 'Horário não encontrado.');
      if (horarios[0].status !== 'livre') throw erro(409, 'Este horário já foi ocupado.');
      const [aceitavel] = await conexao.execute('SELECT TIMESTAMPDIFF(MINUTE, NOW(), ?) AS minutos', [horarios[0].inicio]);
      if (aceitavel[0].minutos <= 120) throw erro(400, 'Agendamentos precisam ser feitos com pelo menos 2 horas de antecedência.');
      const [resultado] = await conexao.execute(
        `INSERT INTO consultas (paciente_id, horario_id, status, confirmar_ate)
         VALUES (?, ?, 'agendada', DATE_SUB(?, INTERVAL 2 HOUR))`, [pacienteId, horarioId, horarios[0].inicio],
      );
      await conexao.execute("UPDATE horarios SET status = 'ocupado' WHERE id = ?", [horarioId]);
      return { id: resultado.insertId, paciente_id: pacienteId, horario_id: horarioId, status: 'agendada' };
    });
    res.status(201).json(consulta);
  } catch (err) { next(err); }
}

async function atualizar(req, res, next) {
  try {
    const id = inteiro(req.params.id);
    if (!id) throw erro(400, 'Consulta inválida.');
    const resultado = await transacao(async (conexao) => {
      const [consultas] = await conexao.execute('SELECT id, paciente_id, horario_id, status, confirmar_ate FROM consultas WHERE id = ? FOR UPDATE', [id]);
      if (!consultas.length) throw erro(404, 'Consulta não encontrada.');
      const consulta = consultas[0];
      if (req.usuario.perfil === 'paciente' && consulta.paciente_id !== req.usuario.id) throw erro(403, 'Você só pode alterar suas próprias consultas.');
      if (!['agendada', 'confirmada'].includes(consulta.status)) throw erro(409, 'Esta consulta já foi encerrada.');

      if (req.body.status === 'confirmada') {
        if (consulta.status === 'confirmada') throw erro(409, 'Consulta já confirmada.');
        const [prazo] = await conexao.execute('SELECT TIMESTAMPDIFF(SECOND, NOW(), ?) AS segundos', [consulta.confirmar_ate]);
        if (prazo[0].segundos <= 0) throw erro(409, 'O prazo para confirmar esta consulta terminou.');
        await conexao.execute("UPDATE consultas SET status = 'confirmada' WHERE id = ?", [id]);
        return { id, status: 'confirmada' };
      }

      const novoHorarioId = inteiro(req.body.horario_id);
      if (!novoHorarioId) throw erro(400, 'Informe status "confirmada" ou um novo horario_id para remarcar.');
      if (novoHorarioId === consulta.horario_id) throw erro(400, 'Escolha um horário diferente para remarcar.');
      const [novoHorario] = await conexao.execute('SELECT id, inicio, status FROM horarios WHERE id = ? FOR UPDATE', [novoHorarioId]);
      if (!novoHorario.length) throw erro(404, 'Novo horário não encontrado.');
      if (novoHorario[0].status !== 'livre') throw erro(409, 'O novo horário já está ocupado.');
      const [prazo] = await conexao.execute('SELECT TIMESTAMPDIFF(MINUTE, NOW(), ?) AS minutos', [novoHorario[0].inicio]);
      if (prazo[0].minutos <= 120) throw erro(400, 'O novo horário precisa ser pelo menos 2 horas no futuro.');
      await conexao.execute(
        `UPDATE consultas SET horario_id = ?, status = 'agendada', confirmar_ate = DATE_SUB(?, INTERVAL 2 HOUR) WHERE id = ?`,
        [novoHorarioId, novoHorario[0].inicio, id],
      );
      await conexao.execute("UPDATE horarios SET status = 'livre' WHERE id = ?", [consulta.horario_id]);
      await conexao.execute("UPDATE horarios SET status = 'ocupado' WHERE id = ?", [novoHorarioId]);
      const proximo = await atribuirProximoDaFila(conexao, consulta.horario_id);
      return { id, horario_id: novoHorarioId, status: 'agendada', vaga_anterior_oferecida: Boolean(proximo) };
    });
    res.json(resultado);
  } catch (err) { next(err); }
}

async function cancelar(req, res, next) {
  try {
    const id = inteiro(req.params.id);
    if (!id) throw erro(400, 'Consulta inválida.');
    const resultado = await transacao(async (conexao) => {
      const [consultas] = await conexao.execute('SELECT id, paciente_id, horario_id, status FROM consultas WHERE id = ? FOR UPDATE', [id]);
      if (!consultas.length) throw erro(404, 'Consulta não encontrada.');
      const c = consultas[0];
      if (req.usuario.perfil === 'paciente' && c.paciente_id !== req.usuario.id) throw erro(403, 'Você só pode cancelar suas próprias consultas.');
      if (!['agendada', 'confirmada'].includes(c.status)) throw erro(409, 'Esta consulta já foi encerrada.');
      await conexao.execute("UPDATE consultas SET status = 'cancelada' WHERE id = ?", [id]);
      await conexao.execute("UPDATE fila_espera SET status = 'cancelada' WHERE consulta_id = ? AND status = 'agendada'", [id]);
      await conexao.execute("UPDATE horarios SET status = 'livre' WHERE id = ?", [c.horario_id]);
      const proximo = await atribuirProximoDaFila(conexao, c.horario_id);
      return { mensagem: 'Consulta cancelada.', vaga_oferecida: Boolean(proximo) };
    });
    res.json(resultado);
  } catch (err) { next(err); }
}

async function registrarResultado(req, res, next) {
  try {
    const id = inteiro(req.params.id);
    const status = req.body.status;
    if (!id || !['compareceu', 'faltou'].includes(status)) throw erro(400, 'Resultado deve ser compareceu ou faltou.');
    const [consultas] = await pool.execute(
      `SELECT c.id, c.status, h.inicio FROM consultas c JOIN horarios h ON h.id = c.horario_id WHERE c.id = ?`, [id],
    );
    if (!consultas.length) throw erro(404, 'Consulta não encontrada.');
    if (!['agendada', 'confirmada'].includes(consultas[0].status)) throw erro(409, 'Resultado já registrado ou consulta cancelada.');
    if (new Date(consultas[0].inicio.replace(' ', 'T')) > new Date()) throw erro(409, 'Só é possível registrar presença após o horário da consulta.');
    await pool.execute('UPDATE consultas SET status = ? WHERE id = ?', [status, id]);
    res.json({ id, status });
  } catch (err) { next(err); }
}

module.exports = { listar, agendar, atualizar, cancelar, registrarResultado };
