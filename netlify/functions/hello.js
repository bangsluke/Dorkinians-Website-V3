exports.handler = async (event, context) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'Hello from Netlify function!',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'unknown'
        })
    };
};
