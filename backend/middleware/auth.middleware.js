import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export const protectRoute = async (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;
        if (!accessToken) {
            return res.status(401).json({ message: "Unauthorized access" });
        }
        try {
            // Verify the access token
            const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
            const user = await User.findById(decoded.userId).select("-password");
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            // Attach user information to the request object
            req.user = decoded;
            next(); // Proceed to the next middleware or route handler

        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({ message: "Access token expired" });
            }
        }

    } catch (error) {
        console.error("Error in protectRoute middleware:", error.message);

        res.status(500).json({ message: "Internal Server Error" });
    }
}

// Admin route middleware to check if the user is an admin

export const adminRoute = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        next(); // Proceed to the next middleware or route handler  
    } else {
        return res.status(403).json({ message: "Access denied, admin only" });

    }
}