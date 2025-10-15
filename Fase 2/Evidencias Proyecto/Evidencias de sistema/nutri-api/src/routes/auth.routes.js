// src/routes/auth.routes.js
import { Router } from "express";
import { registerController, loginController, checkEmailController } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.post("/check-email", checkEmailController);

export default router;
