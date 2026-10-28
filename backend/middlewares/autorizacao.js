function autorizacaoMiddleware(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Seu perfil não tem permissão para esta ação.' });
    }
    next();
  };
}

module.exports = autorizacaoMiddleware;