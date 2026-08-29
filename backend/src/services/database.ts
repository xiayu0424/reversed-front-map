import mongoose from 'mongoose';
import pino from 'pino';

const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        logger.debug("[Database] MongoDB already connected.");
        return;
    }

    if (!process.env.MONGODB_URI) {
        logger.warn("[Database] MONGODB_URI is not defined. Timelapse features are disabled.");
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info("[Database] MongoDB Connected...");
    } catch (err: any) {
        logger.error("[Database] MongoDB connection error:", err.message);
        logger.warn("[Database] Timelapse features are disabled until MongoDB is available.");
    }
};

export default connectDB;
