const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

try {
    // We expect the path to the serviceAccountKey.json to be provided via environment variables.
    // By default, we can look for it in the project root if it exists for local development.
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
        ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
        : path.resolve(__dirname, '../../serviceAccountKey.json');

    if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Firebase service account file not found at ${serviceAccountPath}`);
    }

    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    console.log('Firebase Admin SDK inicializado correctamente.');
} catch (error) {
    console.error('Error al inicializar Firebase Admin SDK:', error.message);
    console.warn('⚠️ Google Sign-In no funcionará hasta que se configure el Service Account de Firebase. Revisa src/config/firebase.admin.js');
    // We throw the error so that the googleSignIn controller catches it and returns 501
    throw error;
}

module.exports = admin;
