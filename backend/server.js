import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.route.js";
import productRoutes from "./routes/product.route.js";
import cartRoutes from "./routes/cart.route.js";
import { connectDB } from "./lib/db.js";

dotenv.config();


const app = express();

app.use(express.json()); //Allow JSON data in requests
app.use(cookieParser()); //Parse cookies from requests

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);

const PORT = process.env.PORT || 6001;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    connectDB();
})