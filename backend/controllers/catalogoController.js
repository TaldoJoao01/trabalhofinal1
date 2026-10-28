const pool = require('../database/conexao');
async function especialidades(req, res, next) {
  try {
    const [linhas] = await pool.query(`SELECT DISTINCT e.id, e.nome, e.descricao FROM especialidades e JOIN profissionais p ON p.especialidade_id = e.id WHERE p.ativo = TRUE ORDER BY e.nome`);
    res.json(linhas);
  } catch (err) { next(err); }
}
module.exports = { especialidades };