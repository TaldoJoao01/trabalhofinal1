const pool = require('../database/conexao');

function erro(status, mensagem) { const e = new Error(mensagem); e.status = status; return e; }
function dataValida(valor) { return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor); }

async function absenteismo(req, res, next) {
  try {
    const { de, ate, especialidade_id: especialidadeId } = req.query;
    if (!dataValida(de) || !dataValida(ate) || de > ate) throw erro(400, 'Informe um período válido nos campos de e até.');
    const filtros = ['DATE(h.inicio) BETWEEN ? AND ?', "c.status IN ('compareceu', 'faltou')"];
    const valores = [de, ate];
    if (especialidadeId) {
      if (!/^\d+$/.test(especialidadeId)) throw erro(400, 'Especialidade inválida.');
      filtros.push('e.id = ?'); valores.push(Number(especialidadeId));
    }
    const [linhas] = await pool.execute(
      `SELECT e.id AS especialidade_id, e.nome AS especialidade,
              SUM(c.status = 'compareceu') AS compareceram,
              SUM(c.status = 'faltou') AS faltaram,
              COUNT(*) AS total,
              ROUND(100 * SUM(c.status = 'faltou') / NULLIF(COUNT(*), 0), 1) AS taxa_faltas
       FROM consultas c JOIN horarios h ON h.id = c.horario_id
       JOIN profissionais p ON p.id = h.profissional_id
       JOIN especialidades e ON e.id = p.especialidade_id
       WHERE ${filtros.join(' AND ')}
       GROUP BY e.id, e.nome ORDER BY e.nome`, valores,
    );
    res.json({ de, ate, resultados: linhas });
  } catch (err) { next(err); }
}

module.exports = { absenteismo };