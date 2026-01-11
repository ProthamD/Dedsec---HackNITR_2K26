/**
 * Merged deployment starter
 * Runs both backend (Express) and Mastra service together
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting merged Inventree deployment...');

// Start Mastra service
console.log('📡 Starting Mastra service on port 4111...');
const mastraProcess = spawn('npm', ['start'], {
    cwd: path.join(__dirname, 'Inventree'),
    stdio: 'inherit',
    shell: true
});

// Wait a bit for Mastra to initialize
setTimeout(() => {
    // Start Backend service
    console.log('🖥️  Starting Backend service on port 3000...');
    const backendProcess = spawn('node', ['app.js'], {
        cwd: path.join(__dirname, 'backend'),
        stdio: 'inherit',
        shell: true
    });

    backendProcess.on('error', (error) => {
        console.error('Backend error:', error);
    });

    backendProcess.on('exit', (code) => {
        console.log(`Backend exited with code ${code}`);
        mastraProcess.kill();
        process.exit(code);
    });
}, 5000);

mastraProcess.on('error', (error) => {
    console.error('Mastra error:', error);
});

mastraProcess.on('exit', (code) => {
    console.log(`Mastra exited with code ${code}`);
    process.exit(code);
});

// Handle shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down...');
    mastraProcess.kill();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Shutting down...');
    mastraProcess.kill();
    process.exit(0);
});
