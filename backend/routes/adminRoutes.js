const express = require('express');
const auth = require('../middlewares/autenticacao');
const permite = require('../middlewares/autorizacao');
const controller = require('../controllers/adminController');
const router = express.Router();

router.use(auth, permite('admin'));
router.get('/usuarios', controller.listarUsuarios);
router.put('/usuarios/:id/perfil', controller.alterarPerfil);
router.get('/:recurso', controller.listar);
router.post('/:recurso', controller.criar);
router.put('/:recurso/:id', controller.atualizar);
router.delete('/:recurso/:id', controller.remover);

module.exports = router;