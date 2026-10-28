const pool = require('../database/conexao');

function erro(status, mensagem) { const e = new Error(mensagem); e.status = status; return e; }
function texto(valor, limite) { return typeof valor === 'string' ? valor.trim().slice(0, limite) : ''; }
function inteiro(valor) { const n = Number(valor); return Number.isInteger(n) && n > 0 ? n : null; }

const recursos = {
  unidades: {
    tabela: 'unidades', campos: ['nome', 'endereco', 'telefone'], obrigatorios: ['nome'],
    listar: 'SELECT id, nome, endereco, telefone FROM unidades ORDER BY nome',
  },
  especialidades: {
    tabela: 'especialidades', campos: ['nome', 'descricao'], obrigatorios: ['nome'],
    listar: 'SELECT id, nome, descricao FROM especialidades ORDER BY nome',
  },
  profissionais: {
    tabela: 'profissionais', campos: ['nome', 'registro', 'unidade_id', 'especialidade_id', 'ativo'], obrigatorios: ['nome', 'unidade_id', 'especialidade_id'],
    listar: `SELECT p.id, p.nome, p.registro, p.unidade_id, p.especialidade_id, p.ativo,
                    u.nome AS unidade, e.nome AS especialidade
             FROM profissionais p JOIN unidades u ON u.id = p.unidade_id
             JOIN especialidades e ON e.id = p.especialidade_id ORDER BY p.nome`,
  },
};

function valoresDoBody(recurso, body) {
  const config = recursos[recurso];
  const valores = {};
  for (const campo of config.campos) {
    if (campo === 'ativo') {
      if (body[campo] !== undefined) valores[campo] = body[campo] === true || body[campo] === 1 || body[campo] === '1';
    } else if (campo.endsWith('_id')) {
      if (body[campo] !== undefined) valores[campo] = inteiro(body[campo]);
    } else if (body[campo] !== undefined) valores[campo] = texto(body[campo], campo === 'endereco' ? 255 : 140);
  }
  for (const campo of config.obrigatorios) {
    if (valores[campo] === undefined || valores[campo] === null || valores[campo] === '') throw erro(400, `Campo obrigatório: ${campo}.`);
  }
  for (const campo of config.campos.filter((c) => c.endsWith('_id'))) {
    if (valores[campo] === null) throw erro(400, `Campo inválido: ${campo}.`);
  }
  return valores;
}

async function listar(req, res, next) {
  try {
    const config = Object.prototype.hasOwnProperty.call(recursos, req.params.recurso) ? recursos[req.params.recurso] : null;
    if (!config) throw erro(404, 'Recurso não encontrado.');
    const [linhas] = await pool.query(config.listar);
    res.json(linhas);
  } catch (err) { next(err); }
}

async function criar(req, res, next) {
  try {
    const config = Object.prototype.hasOwnProperty.call(recursos, req.params.recurso) ? recursos[req.params.recurso] : null;
    if (!config) throw erro(404, 'Recurso não encontrado.');
    const dados = valoresDoBody(req.params.recurso, req.body);
    const campos = Object.keys(dados);
    if (!campos.length) throw erro(400, 'Informe pelo menos um campo.');
    const [resultado] = await pool.execute(
      `INSERT INTO ${config.tabela} (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
      campos.map((campo) => dados[campo]),
    );
    res.status(201).json({ id: resultado.insertId, ...dados });
  } catch (err) { next(err); }
}

async function atualizar(req, res, next) {
  try {
    const config = Object.prototype.hasOwnProperty.call(recursos, req.params.recurso) ? recursos[req.params.recurso] : null;
    const id = inteiro(req.params.id);
    if (!config) throw erro(404, 'Recurso não encontrado.');
    if (!id) throw erro(400, 'Identificador inválido.');
    const dados = valoresDoBody(req.params.recurso, req.body);
    const campos = Object.keys(dados);
    if (!campos.length) throw erro(400, 'Informe pelo menos um campo.');
    const [resultado] = await pool.execute(
      `UPDATE ${config.tabela} SET ${campos.map((campo) => `${campo} = ?`).join(', ')} WHERE id = ?`,
      [...campos.map((campo) => dados[campo]), id],
    );
    if (!resultado.affectedRows) {
      const [existentes] = await pool.execute(`SELECT id FROM ${config.tabela} WHERE id = ?`, [id]);
      if (!existentes.length) throw erro(404, 'Registro não encontrado.');
    }
    res.json({ id, ...dados });
  } catch (err) { next(err); }
}

async function remover(req, res, next) {
  try {
    const config = Object.prototype.hasOwnProperty.call(recursos, req.params.recurso) ? recursos[req.params.recurso] : null;
    const id = inteiro(req.params.id);
    if (!config) throw erro(404, 'Recurso não encontrado.');
    if (!id) throw erro(400, 'Identificador inválido.');
    const [resultado] = await pool.execute(`DELETE FROM ${config.tabela} WHERE id = ?`, [id]);
    if (!resultado.affectedRows) throw erro(404, 'Registro não encontrado.');
    res.status(204).end();
  } catch (err) { next(err); }
}

async function listarUsuarios(req, res, next) {
  try {
    const [usuarios] = await pool.query(
      `SELECT u.id, u.nome, u.email, u.ativo, p.nome AS perfil
       FROM usuarios u JOIN perfis p ON p.id = u.perfil_id ORDER BY u.nome`,
    );
    res.json(usuarios);
  } catch (err) { next(err); }
}

async function alterarPerfil(req, res, next) {
  try {
    const id = inteiro(req.params.id);
    const perfil = texto(req.body.perfil, 30);
    if (!id || !['paciente', 'atendente', 'admin'].includes(perfil)) throw erro(400, 'Informe usuário e perfil válidos.');
    if (id === req.usuario.id) throw erro(409, 'Não é possível alterar o próprio perfil.');
    const [resultado] = await pool.execute(
      'UPDATE usuarios SET perfil_id = (SELECT id FROM perfis WHERE nome = ?) WHERE id = ?', [perfil, id],
    );
    if (!resultado.affectedRows) {
      const [usuarios] = await pool.execute('SELECT id FROM usuarios WHERE id = ?', [id]);
      if (!usuarios.length) throw erro(404, 'Usuário não encontrado.');
    }
    res.json({ id, perfil });
  } catch (err) { next(err); }
}

module.exports = { listar, criar, atualizar, remover, listarUsuarios, alterarPerfil };
