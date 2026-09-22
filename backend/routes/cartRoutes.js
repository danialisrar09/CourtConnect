const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { getCart, addCartItem, updateCartItem, removeCartItem, clearCart } = require('../controllers/cartController');

router.use(authenticate);

router.get('/', getCart);
router.post('/', addCartItem);
router.patch('/:id', updateCartItem);
router.delete('/:id', removeCartItem);
router.delete('/', clearCart);

module.exports = router;
