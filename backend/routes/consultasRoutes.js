const express = require('express');
const auth = require('../middlewares/autenticacao');
const permite = require('../middlewares/autorizacao');
const controller = require('../controllers/consultasController');
const router = express.Router();

router.use(auth);
router.get('/', controller.listar);
router.post('/', controller.agendar);
router.put('/:id/resultado', permite('atendente', 'admin'), controller.registrarResultado);
router.put('/:id', controller.atualizar);
router.delete('/:id', controller.cancelar);

module.exports = router;