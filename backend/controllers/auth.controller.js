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

// this setCookies function sets the access and refresh token into browser cookies for the user
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
        // Store the refresh token in Redis
        if (!accessToken || !refreshToken) {
            return res.status(500).json({ message: "Error generating tokens" });
        }
        await storeRefreshToken(user._id, refreshToken);
        // Set the cookies for user browser
        setCookies(res, accessToken, refreshToken);
        // Return the user data and success message
        res.status(201).json({
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
            }, message: "User created successfully",
        });

    } catch (error) {
        console.error("Error during Signup:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }


}


export const login = async (req, res) => { }

export const logout = async (req, res) => {
    try {
        // Get the refresh token from cookies from user browser
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(400).json({ message: "No refresh token provided" });
        }
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        // Remove the refresh token from Redis 
        // here meaning of decoded.userId is the user id of the user who is logged in
        await redis.del(`refresh_token:${decoded.userId}`);
        // Clear the cookies in user browser
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Error during Logout:", error.message);
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Refresh token expired" });
        }
        res.status(500).json({ message: "Internal Server Error" });

    }
}