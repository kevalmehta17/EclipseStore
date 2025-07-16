import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { addToCart, getCardProducts, removeAllFromCart, updateQuantity } from "../controllers/cart.controller.js";

const router = express.Router();

router.get("/", protectRoute, getCardProducts);
router.post("/", protectRoute, addToCart);
router.put("/", protectRoute, updateQuantity);
router.delete("/:id", protectRoute, removeAllFromCart);


export default router;