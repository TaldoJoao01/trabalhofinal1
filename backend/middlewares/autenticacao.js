const jwt = require('jsonwebtoken');

function autenticacaoMiddleware(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Informe um token Bearer válido.' });
  }
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

module.exports = autenticacaoMiddleware;