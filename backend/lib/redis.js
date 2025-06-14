import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export const redis = new Redis(process.env.UPSTASH_REDIS_URL);


// Redis Overview:
// Redis is an in-memory data structure store, used as a database, cache, and message broker.
// It supports various data structures such as strings, hashes, lists, sets, and sorted sets.
// Redis is known for its high performance, flexibility, and wide range of use cases.
// It is often used for caching, real-time analytics, session management, and pub/sub messaging.
// It store the data in key-value pairs, where keys are unique identifiers and values can be any data type.