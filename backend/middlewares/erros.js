function naoEncontrado(req, res, next) {
  const erro = new Error('Rota não encontrada.');
  erro.status = 404;
  next(erro);
}

function tratarErro(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ erro: 'Um dos registros relacionados não existe.' });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ erro: 'Já existe um registro com esses dados.' });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({ erro: 'Não é possível excluir: existem registros relacionados.' });
  }
  const status = Number(err.status) || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ erro: status >= 500 ? 'Erro interno do servidor.' : err.message });
}

module.exports = { naoEncontrado, tratarErro };