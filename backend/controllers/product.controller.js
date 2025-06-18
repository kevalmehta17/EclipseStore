import cloudinary from "../lib/cloudinary.js";
import { redis } from "../lib/redis.js";
import Product from "../models/product.model.js";

// admin can see all products
export const getAllProducts = async (req, res) => {
    try {
        // Fetch all products from the database
        const products = await Product.find({});
        console.log("Admin can see all products:", products);
        res.json({
            products,
            message: "Products fetched successfully",
        });

    } catch (error) {
        console.error("Error fetching products:", error.message);
        res.status(500).json({ message: "Internal Server Error" });

    }
}

// featured products are those that are marked as isFeatured: true in the database
// featured means that these products are highlighted on the homepage or in a special section of the website 
export const getFeaturedProducts = async (req, res) => {
    try {
        // Check if featured products are cached in Redis (this will help reduce database load)
        let featuredProducts = await redis.get("featured_products");
        if (featuredProducts) {
            console.log("Featured products fetched from cache");
            return res.json({
                products: JSON.parse(featuredProducts),
                message: "Featured products fetched successfully from cache",
            });
        }
        // If not in redis then Fetch featured products from the MongoDB database
        featuredProducts = await Product.find({ isFeatured: true }).lean();
        // .lean() is used to return plain JavaScript objects instead of Mongoose documents, which can be more efficient for read operations.
        if (featuredProducts.length === 0) {
            return res.status(404).json({ message: "No featured products found" });
        }
        // Store the featured products in Redis for future requests
        await redis.set("featured_products", JSON.stringify(featuredProducts));
        res.json({
            products: featuredProducts,
            message: "Featured products fetched successfully",
        });
    } catch (error) {
        console.error("Error fetching featured products:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// Only admin can create a product
export const createProduct = async (req, res) => {
    try {
        // take the product data from the request body
        const { name, description, price, image, isFeatured } = req.body;

        let cloudinaryResponse = null;
        // If an image is provided, upload it to Cloudinary
        if (image) {
            cloudinaryResponse = await cloudinary.uploader.upload(image, {
                folder: "products", // Optional: specify a folder in Cloudinary
                resource_type: "image" // Specify the resource type as image
            })
        }
        console.log("Image uploaded to Cloudinary:", cloudinaryResponse);
        // create a new Product instance in the db
        const product = await Product.create({
            name,
            description,
            price,
            image: cloudinaryResponse ? cloudinaryResponse.secure_url : "", // Use the URL from Cloudinary if an image was uploaded
            category
        })

        res.status(201).json({
            product,
            message: "Product created successfully"
        })

    } catch (error) {
        console.error("Error creating product:", error.message);
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}

// Only admin can delete a product
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        // Find the product by ID and delete it
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            })
        }
        // If the product has an image, delete it from Cloudinary
        if (product.image) {
            // https://res.cloudinary.com/yourcloud/image/upload/v1711234567/products/abc123.jpg
            // output:- of above line will return "abc123" as public ID
            const publicId = product.image.split("/").pop().split(".")[0]; // Extract the public ID from the image URL
            try {
                // it is stored in the cloudinary folder "products"
                await cloudinary.uploader.destroy(`products/${publicId}`, {
                    resource_type: "image" // Specify the resource type as image
                });
                console.log("Image deleted from Cloudinary successfully");
                res.status(200).json({
                    success: true,
                    message: "Product deleted successfully"
                });
            } catch (error) {
                console.error("Error deleting image from Cloudinary:", error.message);
                res.status(500).json({
                    success: false,
                    message: "Failed to delete product image from Cloudinary"
                });
            }
        }
        res.status(200).json({
            success: true,
            message: "Product deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting product:", error.message);
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}

export const getRecommendedProducts = async (req, res) => {
    try {
        // Fetch 3 random products from the database
        const products = await Product.aggregate([
            { $sample: { size: 3 } }, // Randomly sample 3 products
            {
                // $project is used to specify which fields to include in the output
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    price: 1,
                    image: 1,
                }
            }
        ])
        res.json({
            products,
            message: "Recommended products fetched successfully",
        })
    } catch (error) {
        console.error("Error fetching recommended products:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export const getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        // Fetch products by category from the database
        const products = await Product.find({ category });
        if (products.length === 0) {
            return res.status(404).json({ message: "No products found in this category" });
        }
        res.json({
            products,
            message: `Products in category '${category}' fetched successfully`,
        })

    } catch (error) {
        console.error("Error fetching products by category:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export const toggleFeaturedProduct = async (req, res) => {
    try {
        // Find the product by ID
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            })
        }
        // Toggle the isFeatured status
        product.isFeatured = !product.isFeatured;
        // Save the updated product
        const updatedProducts = await product.save();
        // update the featured products cache in Redis
        await updateFeaturedProductsCache();
        res.status(200).json({ updatedProducts });
    } catch (error) {
        console.error("Error toggling featured product:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

// Helper function to update the featured products cache in Redis
async function updateFeaturedProductsCache() {
    try {
        // Fetch the featured products from the database
        // lean() is used to return plain JavaScript objects instead of Mongoose documents, which can be more efficient for read operations.
        const featuredProducts = await Product.find({ isFeatured: true }).lean();
        // Store the featured products in Redis
        await redis.set("featured_products", JSON.stringify(featuredProducts));
        console.log("Featured products cache updated successfully");
    } catch (error) {
        console.error("Error updating featured products cache:", error.message);
    }
}