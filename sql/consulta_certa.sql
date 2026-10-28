-- Banco de dados inicial do Consulta Certa.
CREATE DATABASE IF NOT EXISTS consulta_certa
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE consulta_certa;

CREATE TABLE IF NOT EXISTS perfis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil_id INT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_perfis FOREIGN KEY (perfil_id) REFERENCES perfis(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS unidades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(140) NOT NULL,
  endereco VARCHAR(255) NOT NULL DEFAULT '',
  telefone VARCHAR(30) NOT NULL DEFAULT '',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_unidades_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS especialidades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao VARCHAR(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profissionais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  registro VARCHAR(40) NULL DEFAULT NULL,
  unidade_id INT NOT NULL,
  especialidade_id INT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_profissionais_unidades FOREIGN KEY (unidade_id) REFERENCES unidades(id),
  CONSTRAINT fk_profissionais_especialidades FOREIGN KEY (especialidade_id) REFERENCES especialidades(id),
  UNIQUE KEY uq_profissional_registro (registro)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS horarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  profissional_id INT NOT NULL,
  inicio DATETIME NOT NULL,
  status ENUM('livre', 'ocupado') NOT NULL DEFAULT 'livre',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_horarios_profissionais FOREIGN KEY (profissional_id) REFERENCES profissionais(id),
  UNIQUE KEY uq_profissional_inicio (profissional_id, inicio),
  KEY idx_horarios_disponiveis (status, inicio)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS consultas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT NOT NULL,
  horario_id INT NOT NULL,
  status ENUM('agendada', 'confirmada', 'cancelada', 'compareceu', 'faltou') NOT NULL DEFAULT 'agendada',
  confirmar_ate DATETIME NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_consultas_pacientes FOREIGN KEY (paciente_id) REFERENCES usuarios(id),
  CONSTRAINT fk_consultas_horarios FOREIGN KEY (horario_id) REFERENCES horarios(id),
  KEY idx_consultas_paciente (paciente_id, criado_em),
  KEY idx_consultas_horario_status (horario_id, status),
  KEY idx_consultas_expiracao (status, confirmar_ate)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fila_espera (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT NOT NULL,
  especialidade_id INT NOT NULL,
  status ENUM('aguardando', 'agendada', 'cancelada') NOT NULL DEFAULT 'aguardando',
  consulta_id INT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fila_pacientes FOREIGN KEY (paciente_id) REFERENCES usuarios(id),
  CONSTRAINT fk_fila_especialidades FOREIGN KEY (especialidade_id) REFERENCES especialidades(id),
  CONSTRAINT fk_fila_consultas FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  KEY idx_fila_ordem (especialidade_id, status, criado_em)
) ENGINE=InnoDB;

INSERT INTO perfis (nome) VALUES ('paciente'), ('atendente'), ('admin')
  ON DUPLICATE KEY UPDATE nome = VALUES(nome);
INSERT INTO especialidades (nome, descricao) VALUES
  ('Clínica geral', 'Atendimento médico geral'),
  ('Pediatria', 'Atendimento de crianças e adolescentes')
  ON DUPLICATE KEY UPDATE descricao = VALUES(descricao);
INSERT INTO unidades (nome, endereco, telefone) VALUES
  ('UBS Central', 'Endereço de demonstração', '')
  ON DUPLICATE KEY UPDATE endereco = VALUES(endereco);
INSERT INTO profissionais (nome, registro, unidade_id, especialidade_id)
SELECT 'Dra. Ana Exemplo', 'DEMO-CG', u.id, e.id
  FROM unidades u CROSS JOIN especialidades e
  WHERE u.nome = 'UBS Central' AND e.nome = 'Clínica geral'
  ON DUPLICATE KEY UPDATE nome = VALUES(nome);
INSERT INTO profissionais (nome, registro, unidade_id, especialidade_id)
SELECT 'Dr. Bruno Exemplo', 'DEMO-PED', u.id, e.id
  FROM unidades u CROSS JOIN especialidades e
  WHERE u.nome = 'UBS Central' AND e.nome = 'Pediatria'
  ON DUPLICATE KEY UPDATE nome = VALUES(nome);