/**
 * Global error handler middleware
 */
const errorMiddleware = (err, req, res, next) => {
    console.error(`[Error] ${err.message}`);
    // console.error(err.stack); // uncomment in development

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        message,
        // In production, you might not want to expose raw error details
        error: process.env.NODE_ENV === 'development' ? err : undefined
    });
};

module.exports = {
    errorMiddleware
};
