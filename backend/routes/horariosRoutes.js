const express = require('express');
const auth = require('../middlewares/autenticacao');
const permite = require('../middlewares/autorizacao');
const controller = require('../controllers/horariosController');
const router = express.Router();

router.get('/', controller.listar);
router.get('/agenda', auth, permite('atendente', 'admin'), controller.agenda);
router.post('/', auth, permite('atendente', 'admin'), controller.criar);
router.put('/:id', auth, permite('atendente', 'admin'), controller.atualizar);
router.delete('/:id', auth, permite('atendente', 'admin'), controller.remover);

module.exports = router;