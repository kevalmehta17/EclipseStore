import { redis } from "../lib/redis.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

// Function to generate access and refresh tokens with helps of JWT
const generateTokens = (userId) => {
    const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "15m" // Access token valid for 15 minutes
    });

    const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: "7d" // Refresh token valid for 7 days
    })
    return { accessToken, refreshToken };
}
// storeRefreshToken function to store the refresh token in Redis
const storeRefreshToken = async (userId, refreshToken) => {
    await redis.set(`refresh_token:${userId}`, refreshToken, 'EX', 60 * 60 * 24 * 7); // Store refresh token for 7 days
}

const setCookies = (res, accessToken, refreshToken) => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
        secure: process.env.NODE_ENV === "production", // Use secure cookies in production
        sameSite: "strict", // Prevents CSRF(Cross site request forgery) attacks
        maxAge: 15 * 60 * 1000 // Access token valid for 15 minutes
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
        secure: process.env.NODE_ENV === "production", // Use secure cookies in production
        sameSite: "strict", // Prevents CSRF(Cross site request forgery) attacks
        maxAge: 7 * 24 * 60 * 60 * 1000 // Refresh token valid for 7 days
    });
}
export const signup = async (req, res) => {
    const { email, password, name } = req.body;
    try {
        // Check if all fields are provided
        if (!email || !password || !name) {
            return res.status(400).json({ message: "All fields are required" });
        }
        // Check if the user already exists
        const userAlreadyExists = await User.findOne({ email });
        if (userAlreadyExists) {
            return res.status(400).json({ message: "User already exists" });
        }
        // Create a new user
        const user = await User.create({
            email,
            password,
            name
        })

        // Authenticated the User with the help of Redis
        const { accessToken, refreshToken } = generateTokens(user._id)
        await storeRefreshToken(user._id, refreshToken);

        setCookies(res, accessToken, refreshToken);
        res.status(201).json({
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
            }, message: "User created successfully",
        });

    } catch (error) {

    }


}


export const login = async (req, res) => { }

export const logout = async (req, res) => { }