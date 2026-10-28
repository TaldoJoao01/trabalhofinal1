require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../database/conexao');

async function main() {
  const nome = (process.env.ADMIN_NOME || '').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA || '';
  if (!nome || !/^\S+@\S+\.\S+$/.test(email) || senha.length < 12 || senha.startsWith('troque_')) {
    throw new Error('Preencha ADMIN_NOME, ADMIN_EMAIL e ADMIN_SENHA (mínimo 12 caracteres) no .env.');
  }
  const [perfis] = await pool.execute('SELECT id FROM perfis WHERE nome = ?', ['admin']);
  if (!perfis.length) throw new Error('Execute sql/consulta_certa.sql antes deste comando.');
  const [existentes] = await pool.execute(
    `SELECT u.id, p.nome AS perfil FROM usuarios u JOIN perfis p ON p.id = u.perfil_id WHERE u.email = ?`, [email],
  );
  if (existentes.length && existentes[0].perfil !== 'admin') throw new Error('ADMIN_EMAIL já pertence a uma conta que não é admin. Escolha outro e-mail local.');
  const hash = await bcrypt.hash(senha, 12);
  if (existentes.length) {
    await pool.execute('UPDATE usuarios SET nome = ?, senha_hash = ?, ativo = TRUE WHERE id = ?', [nome, hash, existentes[0].id]);
  } else {
    await pool.execute('INSERT INTO usuarios (nome, email, senha_hash, perfil_id) VALUES (?, ?, ?, ?)', [nome, email, hash, perfis[0].id]);
  }
  console.log(`Administrador de teste pronto: ${email}`);
}
main().catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => pool.end());