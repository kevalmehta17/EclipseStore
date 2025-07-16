import Product from "../models/product.model.js";

export const addToCart = async (req, res) => {
    try {
        const { productId } = req.body;
        // get the user from the request object
        const user = req.user;

        // if item already exists in the cart then increase the quantity
        const existingItem = await user.cartItems.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += 1; // Increase the quantity by 1
        } else {
            // If item does not exist, add it to the cart
            user.cartItems.push({ product: productId, quantity: 1 });
        }
        await user.save(); // Save the updated user document
        res.status(200).json({ cartItems: user.cartItems, message: "Item added to cart successfully" });

    } catch (error) {
        console.error("Error adding to cart:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getCardProducts = async (req, res) => {
    try {
        // get the user from the request object
        const user = req.user;

        const products = await Product.find({ _id: { $in: user.cartItems } });

        const cartItems = products.map(product => {
            const item = user.cartItems.find(cartItem => cartItem.id === product.id);
            return {
                ...product.toJSON(), // Convert product to JSON
                quantity: item ? item.quantity : 0 // Add quantity from cartItems
            }
        });
        res.status(200).json({ cartItems, message: "Cart products retrieved successfully" });
    } catch (error) {
        console.error("Error getting cart products:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}
// this function will update the quantity of an item in the cart (increase or decrease)
export const updateQuantity = async (req, res) => {
    try {
        const { id: productId } = req.params;
        const { quantity } = req.body;
        // get the user from the request object
        const user = req.user;
        // Find the item in the cart
        const existingItem = user.cartItems.find(item => item.id === productId);
        if (existingItem) {
            if (quantity === 0) {
                user.cartItems = user.cartItems.filter(item => item.id !== productId); // Remove the item if quantity is 0
                await user.save(); // Save the updated user document
                return res.status(200).json({ cartItems: user.cartItems, message: "Item removed from cart successfully" });
            }
            else {
                existingItem.quantity = quantity; // Update the quantity
                await user.save(); // Save the updated user document
                return res.status(200).json({ cartItems: user.cartItems, message: "Item quantity updated successfully" });
            }
        } else {
            console.log("Item not found in cart");
            return res.status(404).json({ message: "Item not found in cart" });
        }
    } catch (error) {
        console.error("Error updating quantity:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const removeAllFromCart = async (req, res) => {
    try {
        const { productId } = req.params;
        // get the user from the request object
        const user = req.user;
        // If productId is not provided, remove all items from the cart
        if (!productId) {
            user.cartItems = []; // Remove all items from the cart
        } else {
            // this will remove the item with the given productId from the cart
            user.cartItems = user.cartItems.filter(item => item.id !== productId);
        }
        await user.save(); // Save the updated user document
        res.status(200).json({
            cartItems: user.cartItems, message: "All items removed from cart successfully"
        });

    } catch (error) {
        console.error("Error removing all items from cart:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}