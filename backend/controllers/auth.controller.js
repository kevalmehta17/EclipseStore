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


export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Check if all fields are provided
        if (!email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid password" });
        }

        // Compare the password with the hashed password in the database
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid email or password" });
        }
        if (user && (await user.comparePassword(password))) {
            // Authenticated the User with the help of Redis
            const { accessToken, refreshToken } = generateTokens(user._id);
            // Store the refresh token in Redis
            if (!accessToken || !refreshToken) {
                return res.status(500).json({ message: "Error generating tokens" });
            }
            await storeRefreshToken(user._id, refreshToken);
            // Set the cookies for user browser
            setCookies(res, accessToken, refreshToken);
            // Return the user data and success message
            res.status(200).json({
                user: {
                    _id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                }, message: "Login successful",
            })
        }

    } catch (error) {
        console.error("Error during Login:", error.message);
        res.status(500).json({ message: "Internal Server Error" });

    }
}

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

// This function is used to refresh the access token using the refresh token because access token is short lived
// It is called when the access token is expired and the user wants to get a new access
// It checks if the refresh token is valid and generates a new access token
export const refreshToken = async (req, res) => {
    try {
        // Get the refresh Token from cookies from user browser
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(400).json({ message: "No refresh token provided" });
        }
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        // Check if the refresh token exists in Redis
        const storedRefreshToken = await redis.get(`refresh_token:${decoded.userId}`);

        if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
            return res.status(401).json({
                message: "Invalid or expired refresh token"
            });
        }
        // Generate a new access token
        const accessToken = jwt.sign({ userId: decoded.userId }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "15m" // Access token valid for 15 minutes)
        });
        // Set the new access token in cookies
        res.cookie("accessToken", accessToken, {
            httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
            secure: process.env.NODE_ENV === "production", // Use secure cookies in production
            sameSite: "strict", // Prevents CSRF(Cross site request forgery) attacks
            maxAge: 15 * 60 * 1000 // Access token valid for 15 minutes
        });
        res.status(200).json({ accessToken, message: "Access token refreshed successfully" });

    } catch (error) {
        console.error("Error during Refresh Token:", error.message);
        res.status(500).json({ message: "Internal Server Error" });

    }
}

// TODO: implement getProfile function to get the user profile
export const getProfile = async (req, res) => {
}