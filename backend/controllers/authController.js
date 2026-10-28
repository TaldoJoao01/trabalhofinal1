const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../database/conexao');

function texto(valor, limite) {
  return typeof valor === 'string' ? valor.trim().slice(0, limite) : '';
}

async function cadastro(req, res, next) {
  try {
    const nome = texto(req.body.nome, 120);
    const email = texto(req.body.email, 160).toLowerCase();
    const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
    if (nome.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || senha.length < 8 || senha.length > 72) {
      return res.status(400).json({ erro: 'Informe nome, e-mail válido e senha entre 8 e 72 caracteres.' });
    }
    const [perfis] = await pool.execute('SELECT id FROM perfis WHERE nome = ?', ['paciente']);
    const hash = await bcrypt.hash(senha, 12);
    const [resultado] = await pool.execute(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil_id) VALUES (?, ?, ?, ?)',
      [nome, email, hash, perfis[0].id],
    );
    return res.status(201).json({ id: resultado.insertId, nome, email, perfil: 'paciente' });
  } catch (err) { return next(err); }
}

async function login(req, res, next) {
  try {
    const email = texto(req.body.email, 160).toLowerCase();
    const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
    const [usuarios] = await pool.execute(
      `SELECT u.id, u.nome, u.email, u.senha_hash, p.nome AS perfil
       FROM usuarios u JOIN perfis p ON p.id = u.perfil_id
       WHERE u.email = ? AND u.ativo = TRUE`, [email],
    );
    if (!usuarios.length || !(await bcrypt.compare(senha, usuarios[0].senha_hash))) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    const usuario = usuarios[0];
    const token = jwt.sign({ id: usuario.id, perfil: usuario.perfil }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '2h',
    });
    return res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil } });
  } catch (err) { return next(err); }
}

async function perfilAtual(req, res, next) {
  try {
    const [usuarios] = await pool.execute(
      `SELECT u.id, u.nome, u.email, p.nome AS perfil
       FROM usuarios u JOIN perfis p ON p.id = u.perfil_id WHERE u.id = ? AND u.ativo = TRUE`,
      [req.usuario.id],
    );
    if (!usuarios.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    return res.json(usuarios[0]);
  } catch (err) { return next(err); }
}

module.exports = { cadastro, login, perfilAtual };