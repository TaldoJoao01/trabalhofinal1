const express = require('express');
const auth = require('../middlewares/autenticacao');
const permite = require('../middlewares/autorizacao');
const controller = require('../controllers/relatoriosController');
const router = express.Router();

router.use(auth, permite('admin'));
router.get('/absenteismo', controller.absenteismo);

module.exports = router;