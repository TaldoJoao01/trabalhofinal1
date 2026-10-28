const API = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '3000'
  ? 'http://localhost:3000/api'
  : '/api';
if (localStorage.getItem('consultaCertaToken')) window.location.replace('painel.html');
const mensagem = document.querySelector('#mensagem-acesso');
const botoesAbas = document.querySelectorAll('[data-formulario]');
for (const botao of botoesAbas) botao.addEventListener('click', () => {
  botoesAbas.forEach((item) => item.classList.toggle('ativa', item === botao));
  document.querySelector('#form-login')?.classList.toggle('oculto', botao.dataset.formulario !== 'login');
  document.querySelector('#form-cadastro')?.classList.toggle('oculto', botao.dataset.formulario !== 'cadastro');
  mensagem.textContent = '';
});
async function enviar(caminho, dados) {
  const resposta = await fetch(`${API}${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(corpo?.erro || 'NÃ£o foi possÃ­vel concluir a operaÃ§Ã£o.');
  return corpo;
}
const formLogin = document.querySelector('#form-login');
if (formLogin) formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault(); mensagem.textContent = 'Entrando...';
  try { const resultado = await enviar('/auth/login', Object.fromEntries(new FormData(evento.currentTarget))); localStorage.setItem('consultaCertaToken', resultado.token); window.location.href = 'painel.html'; }
  catch (erro) { mensagem.textContent = erro.message; }
});
const formCadastro = document.querySelector('#form-cadastro');
if (formCadastro) formCadastro.addEventListener('submit', async (evento) => {
  evento.preventDefault(); mensagem.textContent = 'Criando conta...'; const dados = Object.fromEntries(new FormData(evento.currentTarget));
  try { await enviar('/auth/cadastro', dados); mensagem.textContent = 'Conta criada. Entre com seu e-mail e senha.'; if (window.location.pathname.endsWith('cadastro.html')) { window.location.href = 'login.html'; return; } document.querySelector('[data-formulario="login"]')?.click(); const email = document.querySelector('#form-login [name="email"]'); if (email) email.value = dados.email; }
  catch (erro) { mensagem.textContent = erro.message; }
});
