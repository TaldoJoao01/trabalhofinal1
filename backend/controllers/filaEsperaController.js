const pool = require('../database/conexao');

function erro(status, mensagem) { const e = new Error(mensagem); e.status = status; return e; }
function inteiro(valor) { const n = Number(valor); return Number.isInteger(n) && n > 0 ? n : null; }
const equipe = (perfil) => ['atendente', 'admin'].includes(perfil);

async function listar(req, res, next) {
  try {
    const filtros = req.usuario.perfil === 'paciente' ? 'f.paciente_id = ?' : '1 = 1';
    const valores = req.usuario.perfil === 'paciente' ? [req.usuario.id] : [];
    const [itens] = await pool.execute(
      `SELECT f.id, f.status, f.criado_em, e.nome AS especialidade,
              u.id AS paciente_id, u.nome AS paciente, f.consulta_id, h.inicio AS horario
       FROM fila_espera f JOIN especialidades e ON e.id = f.especialidade_id
       JOIN usuarios u ON u.id = f.paciente_id
       LEFT JOIN consultas c ON c.id = f.consulta_id LEFT JOIN horarios h ON h.id = c.horario_id
       WHERE ${filtros} ORDER BY f.criado_em`, valores,
    );
    res.json(itens);
  } catch (err) { next(err); }
}

async function entrar(req, res, next) {
  try {
    const especialidadeId = inteiro(req.body.especialidade_id);
    const pacienteId = equipe(req.usuario.perfil) && req.body.paciente_id ? inteiro(req.body.paciente_id) : req.usuario.id;
    if (!especialidadeId || !pacienteId) throw erro(400, 'Informe uma especialidade válida.');
    const [pacientes] = await pool.execute(
      "SELECT u.id FROM usuarios u JOIN perfis p ON p.id = u.perfil_id WHERE u.id = ? AND u.ativo = TRUE AND p.nome = 'paciente'",
      [pacienteId],
    );
    if (!pacientes.length) throw erro(404, 'Paciente não encontrado.');
    const [existente] = await pool.execute(
      "SELECT id FROM fila_espera WHERE paciente_id = ? AND especialidade_id = ? AND status = 'aguardando' LIMIT 1",
      [pacienteId, especialidadeId],
    );
    if (existente.length) throw erro(409, 'Este paciente já está aguardando nesta especialidade.');
    const [resultado] = await pool.execute(
      "INSERT INTO fila_espera (paciente_id, especialidade_id, status) VALUES (?, ?, 'aguardando')",
      [pacienteId, especialidadeId],
    );
    res.status(201).json({ id: resultado.insertId, status: 'aguardando' });
  } catch (err) { next(err); }
}

async function sair(req, res, next) {
  try {
    const id = inteiro(req.params.id);
    if (!id) throw erro(400, 'Entrada inválida.');
    const [itens] = await pool.execute('SELECT id, paciente_id, status FROM fila_espera WHERE id = ?', [id]);
    if (!itens.length) throw erro(404, 'Entrada não encontrada.');
    if (req.usuario.perfil === 'paciente' && itens[0].paciente_id !== req.usuario.id) throw erro(403, 'Você só pode sair da sua própria fila.');
    if (itens[0].status !== 'aguardando') throw erro(409, 'A entrada já foi atendida ou cancelada.');
    await pool.execute("UPDATE fila_espera SET status = 'cancelada' WHERE id = ?", [id]);
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { listar, entrar, sair };