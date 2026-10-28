const express = require('express');
const autenticacao = require('../middlewares/autenticacao');
const controller = require('../controllers/authController');
const router = express.Router();

router.post('/cadastro', controller.cadastro);
router.post('/login', controller.login);
router.get('/perfil', autenticacao, controller.perfilAtual);

module.exports = router;