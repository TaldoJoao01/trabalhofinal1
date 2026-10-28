const pool = require('../database/conexao');
const transacao = require('../database/transacao');

function erro(status, mensagem) { const e = new Error(mensagem); e.status = status; return e; }
function inteiro(valor) { const n = Number(valor); return Number.isInteger(n) && n > 0 ? n : null; }
function dataValida(valor) { return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor); }
function inicioValido(valor) { return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(valor); }
function inicioSql(valor) { return valor.replace('T', ' ').slice(0, 19); }

async function listar(req, res, next) {
  try {
    const filtros = ["h.status = 'livre'", 'h.inicio > DATE_ADD(NOW(), INTERVAL 2 HOUR)', 'p.ativo = TRUE'];
    const valores = [];
    if (req.query.especialidade_id) {
      const id = inteiro(req.query.especialidade_id);
      if (!id) throw erro(400, 'Especialidade inválida.');
      filtros.push('p.especialidade_id = ?'); valores.push(id);
    }
    if (req.query.data) {
      if (!dataValida(req.query.data)) throw erro(400, 'Data inválida. Use AAAA-MM-DD.');
      filtros.push('DATE(h.inicio) = ?'); valores.push(req.query.data);
    }
    const [horarios] = await pool.execute(
      `SELECT h.id, h.inicio, u.nome AS unidade, e.id AS especialidade_id,
              e.nome AS especialidade, p.id AS profissional_id, p.nome AS profissional
       FROM horarios h JOIN profissionais p ON p.id = h.profissional_id
       JOIN unidades u ON u.id = p.unidade_id JOIN especialidades e ON e.id = p.especialidade_id
       WHERE ${filtros.join(' AND ')} ORDER BY h.inicio LIMIT 100`, valores,
    );
    res.json(horarios);
  } catch (err) { next(err); }
}

async function agenda(req, res, next) {
  try {
    const filtros = []; const valores = [];
    if (req.query.data) {
      if (!dataValida(req.query.data)) throw erro(400, 'Data inválida. Use AAAA-MM-DD.');
      filtros.push('DATE(h.inicio) = ?'); valores.push(req.query.data);
    }
    const [horarios] = await pool.execute(
      `SELECT h.id, h.inicio, h.status, h.profissional_id, u.nome AS unidade, e.nome AS especialidade,
              p.nome AS profissional, c.id AS consulta_id, c.status AS consulta_status,
              paciente.nome AS paciente
       FROM horarios h JOIN profissionais p ON p.id = h.profissional_id
       JOIN unidades u ON u.id = p.unidade_id JOIN especialidades e ON e.id = p.especialidade_id
       LEFT JOIN consultas c ON c.id = (SELECT MAX(c2.id) FROM consultas c2 WHERE c2.horario_id = h.id)
       LEFT JOIN usuarios paciente ON paciente.id = c.paciente_id
       WHERE ${filtros.length ? filtros.join(' AND ') : 'h.inicio >= NOW()'} ORDER BY h.inicio LIMIT 300`, valores,
    );
    res.json(horarios);
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const profissionalId = inteiro(req.body.profissional_id);
    if (!profissionalId || !inicioValido(req.body.inicio)) throw erro(400, 'Informe profissional e início válido.');
    const inicio = inicioSql(req.body.inicio);
    const [resultado] = await pool.execute(
      `INSERT INTO horarios (profissional_id, inicio, status)
       SELECT id, ?, 'livre' FROM profissionais WHERE id = ? AND ativo = TRUE
         AND ? > DATE_ADD(NOW(), INTERVAL 2 HOUR)`, [inicio, profissionalId, inicio],
    );
    if (!resultado.affectedRows) throw erro(400, 'Profissional inválido ou horário precisa ser pelo menos 2 horas no futuro.');
    res.status(201).json({ id: resultado.insertId, profissional_id: profissionalId, inicio, status: 'livre' });
  } catch (err) { next(err); }
}

async function atualizar(req, res, next) {
  try {
    const id = inteiro(req.params.id);
    const profissionalId = inteiro(req.body.profissional_id);
    if (!id || !profissionalId || !inicioValido(req.body.inicio)) throw erro(400, 'Informe horário, profissional e início válido.');
    const inicio = inicioSql(req.body.inicio);
    const resultado = await transacao(async (conexao) => {
      const [horarios] = await conexao.execute('SELECT id, status FROM horarios WHERE id = ? FOR UPDATE', [id]);
      if (!horarios.length) throw erro(404, 'Horário não encontrado.');
      if (horarios[0].status !== 'livre') throw erro(409, 'Só é possível alterar um horário livre.');
      const [alterado] = await conexao.execute(
        `UPDATE horarios SET profissional_id = ?, inicio = ?
         WHERE id = ? AND EXISTS (SELECT id FROM profissionais WHERE id = ? AND ativo = TRUE)
           AND ? > DATE_ADD(NOW(), INTERVAL 2 HOUR)`, [profissionalId, inicio, id, profissionalId, inicio],
      );
      if (!alterado.affectedRows) throw erro(400, 'Profissional inválido ou horário precisa ser pelo menos 2 horas no futuro.');
      return { id, profissional_id: profissionalId, inicio, status: 'livre' };
    });
    res.json(resultado);
  } catch (err) { next(err); }
}

async function remover(req, res, next) {
  try {
    const id = inteiro(req.params.id);
    if (!id) throw erro(400, 'Horário inválido.');
    const [horarios] = await pool.execute('SELECT status FROM horarios WHERE id = ?', [id]);
    if (!horarios.length) throw erro(404, 'Horário não encontrado.');
    if (horarios[0].status !== 'livre') throw erro(409, 'Não é possível excluir um horário ocupado.');
    const [usos] = await pool.execute('SELECT id FROM consultas WHERE horario_id = ? LIMIT 1', [id]);
    if (usos.length) throw erro(409, 'Este horário tem histórico de consultas e não pode ser excluído.');
    await pool.execute('DELETE FROM horarios WHERE id = ?', [id]);
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { listar, agenda, criar, atualizar, remover };