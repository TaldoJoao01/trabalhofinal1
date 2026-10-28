require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../database/conexao');

function dataLocal(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}
async function prepararHorario(profissionalId, data, hora, status) {
  const inicio = `${data} ${hora}`;
  const [existentes] = await pool.execute('SELECT id FROM horarios WHERE profissional_id = ? AND inicio = ?', [profissionalId, inicio]);
  if (existentes.length) return existentes[0].id;
  const [resultado] = await pool.execute('INSERT INTO horarios (profissional_id, inicio, status) VALUES (?, ?, ?)', [profissionalId, inicio, status]);
  return resultado.insertId;
}

async function criarHistoricoDemo(profissionais) {
  const email = (process.env.DEMO_PACIENTE_EMAIL || '').trim().toLowerCase();
  const senha = process.env.DEMO_PACIENTE_SENHA || '';
  if (!email || !senha || senha.startsWith('troque_')) {
    console.log('Para incluir um histórico no relatório, preencha DEMO_PACIENTE_EMAIL e DEMO_PACIENTE_SENHA no .env.');
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || senha.length < 12) throw new Error('A conta demo precisa de e-mail válido e senha com pelo menos 12 caracteres.');
  const [perfil] = await pool.execute('SELECT id FROM perfis WHERE nome = ?', ['paciente']);
  const [existentes] = await pool.execute(
    `SELECT u.id, p.nome AS perfil FROM usuarios u JOIN perfis p ON p.id = u.perfil_id WHERE u.email = ?`, [email],
  );
  if (existentes.length && existentes[0].perfil !== 'paciente') throw new Error('Use um e-mail demo que não pertença a atendente ou admin.');
  let pacienteId;
  if (existentes.length) {
    pacienteId = existentes[0].id;
  } else {
    const hash = await bcrypt.hash(senha, 12);
    const [resultado] = await pool.execute(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil_id) VALUES (?, ?, ?, ?)',
      ['Paciente de demonstração', email, hash, perfil[0].id],
    );
    pacienteId = resultado.insertId;
  }
  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
  const data = dataLocal(ontem);
  let historicos = 0;
  for (let i = 0; i < Math.min(2, profissionais.length); i += 1) {
    const horarioId = await prepararHorario(profissionais[i].id, data, i === 0 ? '09:00:00' : '10:00:00', 'ocupado');
    await pool.execute("UPDATE horarios SET status = 'ocupado' WHERE id = ?", [horarioId]);
    const [jaExiste] = await pool.execute('SELECT id FROM consultas WHERE horario_id = ? LIMIT 1', [horarioId]);
    if (jaExiste.length) continue;
    await pool.execute(
      `INSERT INTO consultas (paciente_id, horario_id, status, confirmar_ate)
       VALUES (?, ?, ?, DATE_SUB(?, INTERVAL 2 HOUR))`,
      [pacienteId, horarioId, i === 0 ? 'compareceu' : 'faltou', `${data} ${i === 0 ? '09:00:00' : '10:00:00'}`],
    );
    historicos += 1;
  }
  console.log(`Conta de paciente demo pronta: ${email}. Registros de histórico criados: ${historicos}.`);
}

async function main() {
  const [profissionais] = await pool.execute('SELECT id FROM profissionais WHERE ativo = TRUE ORDER BY id');
  if (!profissionais.length) throw new Error('Cadastre ao menos um profissional antes de criar horários.');
  for (const profissional of profissionais) {
    for (let dia = 1; dia <= 10; dia += 1) {
      const data = new Date(); data.setDate(data.getDate() + dia);
      for (const hora of ['09:00:00', '10:00:00', '14:00:00', '15:00:00']) {
        await prepararHorario(profissional.id, dataLocal(data), hora, 'livre');
      }
    }
  }
  console.log(`Horários livres preparados para ${profissionais.length} profissional(is).`);
  await criarHistoricoDemo(profissionais);
}
main().catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => pool.end());