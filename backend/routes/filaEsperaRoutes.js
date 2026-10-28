const express = require('express');
const auth = require('../middlewares/autenticacao');
const controller = require('../controllers/filaEsperaController');
const router = express.Router();

router.use(auth);
router.get('/', controller.listar);
router.post('/', controller.entrar);
router.delete('/:id', controller.sair);

module.exports = router;