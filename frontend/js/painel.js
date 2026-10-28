const API = '/api';
const token = localStorage.getItem('consultaCertaToken');
const $ = (seletor) => document.querySelector(seletor);
const mensagem = $('#mensagem-painel');
let usuarioAtual;
function escapeHtml(valor) { return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function dataLocal(valor) { return valor ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(valor).replace(' ', 'T'))) : '—'; }
function dataHoje() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`${API}${caminho}`, { ...opcoes, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}), ...opcoes.headers } });
  const corpo = resposta.status === 204 ? null : await resposta.json().catch(() => null);
  if (resposta.status === 401) { localStorage.removeItem('consultaCertaToken'); window.location.replace('index.html'); }
  if (!resposta.ok) throw new Error(corpo?.erro || 'Ocorreu um erro ao falar com o servidor.');
  return corpo;
}
function avisar(texto, erro = false) { mensagem.textContent = texto; mensagem.classList.toggle('erro', erro); }
function botao(texto, classe, atributos = '') { return `<button class="botao ${classe}" type="button" ${atributos}>${texto}</button>`; }

async function iniciar() {
  if (!token) { window.location.replace('index.html'); return; }
  try {
    usuarioAtual = await api('/auth/perfil');
    $('#nome-usuario').textContent = usuarioAtual.nome;
    $('#titulo-painel').textContent = `Olá, ${usuarioAtual.nome.split(' ')[0]}`;
    $('#perfil-usuario').textContent = usuarioAtual.perfil;
    if (usuarioAtual.perfil === 'paciente') { $('#area-paciente').classList.remove('oculto'); await iniciarPaciente(); }
    if (['atendente', 'admin'].includes(usuarioAtual.perfil)) { $('#area-atendente').classList.remove('oculto'); await iniciarAtendente(); }
    if (usuarioAtual.perfil === 'admin') { $('#area-admin').classList.remove('oculto'); await iniciarAdmin(); }
  } catch (erro) { avisar(erro.message, true); }
}
async function iniciarPaciente() {
  await carregarEspecialidades();
  $('#form-filtro-horarios').addEventListener('submit', (evento) => { evento.preventDefault(); carregarHorarios(); });
  $('#form-fila').addEventListener('submit', entrarFila);
  $('#atualizar-consultas').addEventListener('click', carregarConsultas);
  await Promise.all([carregarHorarios(), carregarConsultas(), carregarFila()]);
}
async function carregarEspecialidades() {
  const itens = await api('/especialidades');
  const opcoes = `<option value="">Selecione...</option>${itens.map((i) => `<option value="${i.id}">${escapeHtml(i.nome)}</option>`).join('')}`;
  $('#filtro-especialidade').innerHTML = opcoes; $('#fila-especialidade').innerHTML = opcoes;
}
async function carregarHorarios() {
  const filtro = Object.fromEntries(new FormData($('#form-filtro-horarios')));
  if (!filtro.especialidade_id) { $('#lista-horarios').innerHTML = '<p class="texto-suave">Selecione uma especialidade para buscar vagas.</p>'; return; }
  try {
    const p = new URLSearchParams({ especialidade_id: filtro.especialidade_id }); if (filtro.data) p.set('data', filtro.data);
    const horarios = await api(`/horarios?${p}`);
    $('#lista-horarios').innerHTML = horarios.length ? horarios.map((h) => `<div class="item-horario"><div><strong>${escapeHtml(h.especialidade)}</strong><span>${dataLocal(h.inicio)} · ${escapeHtml(h.profissional)}</span><small>${escapeHtml(h.unidade)}</small></div>${botao('Agendar', 'principal pequeno', `data-agendar="${h.id}"`)}</div>`).join('') : '<p class="texto-suave">Nenhum horário disponível para esses filtros.</p>';
    document.querySelectorAll('[data-agendar]').forEach((b) => b.addEventListener('click', async () => {
      try { await api('/consultas', { method: 'POST', body: JSON.stringify({ horario_id: Number(b.dataset.agendar) }) }); avisar('Consulta agendada. Confirme até 2 horas antes.'); await Promise.all([carregarHorarios(), carregarConsultas()]); }
      catch (e) { avisar(e.message, true); }
    }));
  } catch (e) { avisar(e.message, true); }
}
async function carregarConsultas() {
  try {
    const cs = await api('/consultas');
    $('#lista-consultas').innerHTML = cs.length ? `<table><thead><tr><th>Quando</th><th>Especialidade</th><th>Profissional</th><th>Status</th><th>Ações</th></tr></thead><tbody>${cs.map((c) => {
      const ativa = ['agendada', 'confirmada'].includes(c.status);
      return `<tr><td>${dataLocal(c.inicio)}</td><td>${escapeHtml(c.especialidade)}</td><td>${escapeHtml(c.profissional)}</td><td><span class="etiqueta">${escapeHtml(c.status)}</span></td><td>${c.status === 'agendada' ? botao('Confirmar', 'pequeno', `data-confirmar="${c.id}"`) : ''}${ativa ? botao('Remarcar', 'pequeno', `data-remarcar="${c.id}" data-especialidade="${c.especialidade_id}"`) : ''}${ativa ? botao('Cancelar', 'perigo pequeno', `data-cancelar="${c.id}"`) : ''}</td></tr>`;
    }).join('')}</tbody></table>` : '<p class="texto-suave">Você ainda não tem consultas.</p>';
    document.querySelectorAll('[data-confirmar]').forEach((b) => b.addEventListener('click', () => acaoConsulta(b.dataset.confirmar, 'PUT', { status: 'confirmada' }, 'Consulta confirmada.')));
    document.querySelectorAll('[data-cancelar]').forEach((b) => b.addEventListener('click', () => acaoConsulta(b.dataset.cancelar, 'DELETE', null, 'Consulta cancelada.')));
    document.querySelectorAll('[data-remarcar]').forEach((b) => b.addEventListener('click', async () => {
      try {
        const horarios = await api(`/horarios?especialidade_id=${b.dataset.especialidade}`);
        if (!horarios.length) { avisar('Não há outros horários livres nessa especialidade.', true); return; }
        const opcoes = horarios.slice(0, 20).map((h, i) => `${i + 1}. ${dataLocal(h.inicio)} · ${h.profissional}`).join('\n');
        const escolha = Number(window.prompt(`Digite o número do novo horário:\n${opcoes}`));
        if (!Number.isInteger(escolha) || escolha < 1 || escolha > Math.min(20, horarios.length)) return;
        await api(`/consultas/${b.dataset.remarcar}`, { method: 'PUT', body: JSON.stringify({ horario_id: horarios[escolha - 1].id }) });
        avisar('Consulta remarcada.'); await Promise.all([carregarConsultas(), carregarHorarios()]);
      } catch (e) { avisar(e.message, true); }
    }));
  } catch (e) { avisar(e.message, true); }
}async function acaoConsulta(id, metodo, dados, sucesso) {
  try { await api(`/consultas/${id}`, { method: metodo, ...(dados ? { body: JSON.stringify(dados) } : {}) }); avisar(sucesso); await Promise.all([carregarConsultas(), carregarHorarios()]); }
  catch (e) { avisar(e.message, true); }
}
async function entrarFila(evento) {
  evento.preventDefault();
  try { await api('/fila-espera', { method: 'POST', body: JSON.stringify({ especialidade_id: Number($('#fila-especialidade').value) }) }); avisar('Você entrou na fila. Volte a este painel para acompanhar as vagas.'); await carregarFila(); }
  catch (e) { avisar(e.message, true); }
}
async function carregarFila() {
  const itens = await api('/fila-espera');
  $('#lista-fila').innerHTML = itens.length ? itens.map((f) => `<div class="linha-fila"><span>${escapeHtml(f.especialidade)} · <b>${escapeHtml(f.status)}</b>${f.horario ? ` · ${dataLocal(f.horario)}` : ''}</span>${f.status === 'aguardando' ? botao('Sair', 'leve pequeno', `data-sair-fila="${f.id}"`) : ''}</div>`).join('') : '<p class="texto-suave">Você não está em nenhuma fila.</p>';
  document.querySelectorAll('[data-sair-fila]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/fila-espera/${b.dataset.sairFila}`, { method: 'DELETE' }); await carregarFila(); avisar('Você saiu da fila.'); } catch (e) { avisar(e.message, true); }
  }));
}
async function iniciarAtendente() {
  $('#form-data-agenda [name="data"]').value = dataHoje();
  $('#form-data-agenda').addEventListener('submit', (e) => { e.preventDefault(); carregarAgenda(); });
  await carregarAgenda();
}
async function carregarAgenda() {
  const data = $('#form-data-agenda [name="data"]').value || dataHoje();
  const itens = await api(`/horarios/agenda?data=${encodeURIComponent(data)}`);
  $('#agenda-unidade').innerHTML = itens.length ? `<table><thead><tr><th>Horário</th><th>Especialidade</th><th>Profissional</th><th>Paciente</th><th>Consulta</th><th>Presença</th></tr></thead><tbody>${itens.map((h) => `<tr><td>${dataLocal(h.inicio)}</td><td>${escapeHtml(h.especialidade)}</td><td>${escapeHtml(h.profissional)}</td><td>${escapeHtml(h.paciente || '—')}</td><td>${escapeHtml(h.consulta_status || h.status)}</td><td>${h.consulta_id && ['agendada', 'confirmada'].includes(h.consulta_status) ? `${botao('Compareceu', 'pequeno', `data-resultado="${h.consulta_id}" data-status="compareceu"`)}${botao('Faltou', 'perigo pequeno', `data-resultado="${h.consulta_id}" data-status="faltou"`)}` : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="texto-suave">Nenhum horário cadastrado para esta data.</p>';
  document.querySelectorAll('[data-resultado]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/consultas/${b.dataset.resultado}/resultado`, { method: 'PUT', body: JSON.stringify({ status: b.dataset.status }) }); avisar('Presença registrada.'); await carregarAgenda(); }
    catch (e) { avisar(e.message, true); }
  }));
}

async function iniciarAdmin() {
  const hoje = dataHoje();
  $('#form-relatorio [name="de"]').value = `${hoje.slice(0, 7)}-01`;
  $('#form-relatorio [name="ate"]').value = hoje;
  $('#form-relatorio').addEventListener('submit', (e) => { e.preventDefault(); carregarRelatorio(); });
  $('#form-criar-horario').addEventListener('submit', criarHorario);
  $('#form-criar-horario').addEventListener('reset', () => setTimeout(() => { $('#form-criar-horario button[type="submit"]').textContent = 'Criar horário'; }, 0));
  $('#form-data-agenda').addEventListener('submit', () => setTimeout(carregarHorariosAdmin, 0));
  await Promise.all([carregarUsuarios(), montarGestao(), carregarProfissionaisSelect()]);
  await carregarHorariosAdmin();
}
async function carregarHorariosAdmin() {
  const data = $('#form-data-agenda [name="data"]').value || dataHoje();
  const itens = await api(`/horarios/agenda?data=${encodeURIComponent(data)}`);
  $('#gestao-horarios').innerHTML = itens.length ? `<table><thead><tr><th>Horário</th><th>Profissional</th><th>Status</th><th>Paciente</th><th>Ações</th></tr></thead><tbody>${itens.map((h) => `<tr><td>${dataLocal(h.inicio)}</td><td>${escapeHtml(h.profissional)}</td><td>${escapeHtml(h.status)}</td><td>${escapeHtml(h.paciente || '—')}</td><td>${h.status === 'livre' ? `${botao('Editar', 'pequeno', `data-editar-horario="${h.id}"`)}${botao('Excluir', 'perigo pequeno', `data-excluir-horario="${h.id}"`)}` : 'Ocupado'}</td></tr>`).join('')}</tbody></table>` : '<p class="texto-suave">Não há horários nesta data.</p>';
  document.querySelectorAll('[data-editar-horario]').forEach((b) => b.addEventListener('click', () => {
    const h = itens.find((item) => item.id === Number(b.dataset.editarHorario)); const form = $('#form-criar-horario');
    form.elements.id.value = h.id; form.elements.profissional_id.value = h.profissional_id; form.elements.inicio.value = String(h.inicio).replace(' ', 'T').slice(0, 16);
    form.querySelector('button[type="submit"]').textContent = 'Salvar alteração'; form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  document.querySelectorAll('[data-excluir-horario]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Excluir este horário livre?')) return;
    try { await api(`/horarios/${b.dataset.excluirHorario}`, { method: 'DELETE' }); avisar('Horário excluído.'); await carregarHorariosAdmin(); }
    catch (e) { avisar(e.message, true); }
  }));
}async function carregarRelatorio() {
  try {
    const dados = Object.fromEntries(new FormData($('#form-relatorio')));
    const r = await api(`/relatorios/absenteismo?de=${dados.de}&ate=${dados.ate}`);
    $('#relatorio').innerHTML = r.resultados.length ? `<table><thead><tr><th>Especialidade</th><th>Compareceram</th><th>Faltaram</th><th>Total</th><th>Taxa</th></tr></thead><tbody>${r.resultados.map((x) => `<tr><td>${escapeHtml(x.especialidade)}</td><td>${x.compareceram}</td><td>${x.faltaram}</td><td>${x.total}</td><td><b>${x.taxa_faltas}%</b></td></tr>`).join('')}</tbody></table>` : '<p class="texto-suave">Ainda não há consultas concluídas neste período.</p>';
  } catch (e) { avisar(e.message, true); }
}
async function carregarUsuarios() {
  const usuarios = await api('/admin/usuarios');
  $('#lista-usuarios').innerHTML = usuarios.length ? `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ação</th></tr></thead><tbody>${usuarios.map((u) => `<tr><td>${escapeHtml(u.nome)}</td><td>${escapeHtml(u.email)}</td><td><select data-perfil-usuario="${u.id}" ${u.id === usuarioAtual.id ? 'disabled' : ''}>${['paciente','atendente','admin'].map((p) => `<option ${u.perfil === p ? 'selected' : ''}>${p}</option>`).join('')}</select></td><td>${u.id === usuarioAtual.id ? 'Sua conta' : botao('Salvar', 'pequeno', `data-salvar-perfil="${u.id}"`)}</td></tr>`).join('')}</tbody></table>` : '<p class="texto-suave">Nenhum usuário cadastrado.</p>';
  document.querySelectorAll('[data-salvar-perfil]').forEach((b) => b.addEventListener('click', async () => {
    const perfil = document.querySelector(`[data-perfil-usuario="${b.dataset.salvarPerfil}"]`).value;
    try { await api(`/admin/usuarios/${b.dataset.salvarPerfil}/perfil`, { method: 'PUT', body: JSON.stringify({ perfil }) }); avisar('Perfil atualizado.'); await carregarUsuarios(); }
    catch (e) { avisar(e.message, true); }
  }));
}

const definicoes = [
  { chave: 'unidades', titulo: 'Unidades', campos: [['nome','Nome'],['endereco','Endereço'],['telefone','Telefone']] },
  { chave: 'especialidades', titulo: 'Especialidades', campos: [['nome','Nome'],['descricao','Descrição']] },
  { chave: 'profissionais', titulo: 'Profissionais', campos: [['nome','Nome'],['registro','Registro'],['unidade_id','ID da unidade'],['especialidade_id','ID da especialidade']] },
];
async function montarGestao() {
  $('#gestao-cadastros').innerHTML = definicoes.map((d) => `<section class="bloco-gestao"><h3>${d.titulo}</h3><form data-form-recurso="${d.chave}">${d.campos.map(([campo, label]) => `<label>${label}<input name="${campo}" ${campo.endsWith('_id') ? 'type="number" min="1"' : 'type="text"'} required></label>`).join('')}<input name="id" type="hidden"><button class="botao contorno" type="submit">Salvar cadastro</button><button class="botao leve" type="reset">Limpar</button></form><div data-lista-recurso="${d.chave}" class="lista-linhas"></div></section>`).join('');
  for (const d of definicoes) {
    await carregarRecurso(d);
    document.querySelector(`[data-form-recurso="${d.chave}"]`).addEventListener('submit', async (evento) => {
      evento.preventDefault(); const form = evento.currentTarget; const dados = Object.fromEntries(new FormData(form)); const id = dados.id; delete dados.id;
      for (const campo of ['unidade_id', 'especialidade_id']) if (dados[campo]) dados[campo] = Number(dados[campo]);
      try { await api(`/admin/${d.chave}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(dados) }); form.reset(); avisar(`${d.titulo} salvo.`); await carregarRecurso(d); await carregarProfissionaisSelect(); }
      catch (e) { avisar(e.message, true); }
    });
  }
}
async function carregarRecurso(d) {
  const itens = await api(`/admin/${d.chave}`);
  const lista = itens.map((item) => `<div class="linha-fila"><span>${escapeHtml(item.nome)}${item.especialidade ? ` · ${escapeHtml(item.especialidade)}` : ''}${item.unidade ? ` · ${escapeHtml(item.unidade)}` : ''}</span><span>${botao('Editar', 'leve pequeno', `data-editar="${d.chave}" data-id="${item.id}"`)}${botao('Excluir', 'perigo pequeno', `data-excluir="${d.chave}" data-id="${item.id}"`)}</span></div>`).join('') || '<p class="texto-suave">Sem cadastros.</p>';
  document.querySelector(`[data-lista-recurso="${d.chave}"]`).innerHTML = lista;
  document.querySelectorAll(`[data-editar="${d.chave}"]`).forEach((b) => b.addEventListener('click', () => {
    const item = itens.find((x) => x.id === Number(b.dataset.id)); const form = document.querySelector(`[data-form-recurso="${d.chave}"]`);
    for (const [campo] of d.campos) form.elements[campo].value = item[campo] ?? '';
    form.elements.id.value = item.id; form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  document.querySelectorAll(`[data-excluir="${d.chave}"]`).forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Excluir este cadastro?')) return;
    try { await api(`/admin/${d.chave}/${b.dataset.id}`, { method: 'DELETE' }); avisar('Cadastro excluído.'); await carregarRecurso(d); await carregarProfissionaisSelect(); }
    catch (e) { avisar(e.message, true); }
  }));
}
async function carregarProfissionaisSelect() {
  const profissionais = await api('/admin/profissionais');
  $('#profissional-horario').innerHTML = `<option value="">Selecione...</option>${profissionais.filter((p) => p.ativo).map((p) => `<option value="${p.id}">${escapeHtml(p.nome)} · ${escapeHtml(p.especialidade)}</option>`).join('')}`;
}
async function criarHorario(evento) {
  evento.preventDefault(); const form = evento.currentTarget; const dados = Object.fromEntries(new FormData(form)); const id = dados.id; delete dados.id;
  try {
    await api(`/horarios${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify({ profissional_id: Number(dados.profissional_id), inicio: dados.inicio }) });
    avisar(id ? 'Horário alterado.' : 'Horário criado.'); form.reset(); await carregarHorariosAdmin();
  } catch (e) { avisar(e.message, true); }
}$('#sair').addEventListener('click', () => { localStorage.removeItem('consultaCertaToken'); window.location.replace('index.html'); });
iniciar();
