require('dotenv').config();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('troque_')) {
  console.error('Configure JWT_SECRET no backend/.env com pelo menos 32 caracteres aleatórios.'); process.exit(1);
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./database/conexao');
const autenticacao = require('./middlewares/autenticacao');
const autorizacao = require('./middlewares/autorizacao');
const { naoEncontrado, tratarErro } = require('./middlewares/erros');
const { encerrarConsulta } = require('./services/agendaService');
const app = express();
app.use(cors());
app.use(express.json({ limit: '20kb' }));
app.get('/api/saude', async (req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', banco: 'conectado' }); } catch (err) { next(err); }
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api', require('./routes/catalogoRoutes'));
app.use('/api/horarios', require('./routes/horariosRoutes'));
app.use('/api/consultas', require('./routes/consultasRoutes'));
app.use('/api/fila-espera', require('./routes/filaEsperaRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/relatorios', require('./routes/relatoriosRoutes'));
app.get('/api/exemplo/protegido', autenticacao, (req, res) => res.json({ mensagem: 'Token válido.', usuario: req.usuario }));
app.get('/api/exemplo/admin', autenticacao, autorizacao('admin'), (req, res) => res.json({ mensagem: 'Acesso de administrador autorizado.' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/api', naoEncontrado);
app.use(tratarErro);
setInterval(async () => {
  try {
    const [expiradas] = await pool.execute("SELECT id FROM consultas WHERE status = 'agendada' AND confirmar_ate <= NOW() LIMIT 50");
    for (const c of expiradas) await encerrarConsulta(c.id);
  } catch (err) { console.error('Falha ao processar confirmações vencidas:', err.message); }
}, 60 * 1000);
const porta = Number(process.env.PORT || 3000);
app.listen(porta, () => console.log(`Consulta Certa disponível em http://localhost:${porta}`));