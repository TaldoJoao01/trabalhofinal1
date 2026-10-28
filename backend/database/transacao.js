const pool = require('./conexao');

// Agrupa alterações relacionadas para evitar reservas pela metade.
async function transacao(acao) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const resultado = await acao(conexao);
    await conexao.commit();
    return resultado;
  } catch (err) {
    await conexao.rollback();
    throw err;
  } finally {
    conexao.release();
  }
}

module.exports = transacao;