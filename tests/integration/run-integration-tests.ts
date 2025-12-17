#!/usr/bin/env ts-node

/**
 * Integration Test Runner for AI Development Insights System
 * 
 * This script orchestrates the complete integration test suite,
 * including backend startup, test execution, and cleanup.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface TestRunnerConfig {
    backendPort: number;
    testTimeout: number;
    maxRetries: number;
    cleanupOnExit: boolean;
}

class IntegrationTestRunner {
    private config: TestRunnerConfig;
    private backendProcess?: ChildProcess;
    private testResults: {
        passed: number;
        failed: number;
        skipped: number;
        errors: string[];
    } = {
        passed: 0,
        failed: 0,
        skipped: 0,
        errors: []
    };

    constructor(config: Partial<TestRunnerConfig> = {}) {
        this.config = {
            backendPort: 3001,
            testTimeout: 60000, // 1 minute
            maxRetries: 3,
            cleanupOnExit: true,
            ...config
        };
    }

    async run(): Promise<boolean> {
        console.log('🚀 Starting AI Development Insights Integration Tests');
        console.log('=' .repeat(60));

        try {
            // Step 1: Setup test environment
            await this.setupTestEnvironment();

            // Step 2: Start backend server
            await this.startBackendServer();

            // Step 3: Wait for backend to be ready
            await this.waitForBackendReady();

            // Step 4: Run integration tests
            await this.runIntegrationTests();

            // Step 5: Generate test report
            this.generateTestReport();

            return this.testResults.failed === 0;

        } catch (error) {
            console.error('❌ Integration test runner failed:', error);
            this.testResults.errors.push(error.message);
            return false;

        } finally {
            // Cleanup
            await this.cleanup();
        }
    }

    private async setupTestEnvironment(): Promise<void> {
        console.log('📋 Setting up test environment...');

        // Create test directories
        const testDirs = [
            'tests/integration/temp',
            'tests/integration/logs',
            'tests/integration/data'
        ];

        for (const dir of testDirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        // Set environment variables for testing
        process.env.NODE_ENV = 'test';
        process.env.PORT = this.config.backendPort.toString();
        process.env.DATABASE_PATH = path.join(process.cwd(), 'tests/integration/temp/test.db');
        process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

        console.log('✅ Test environment setup complete');
    }

    private async startBackendServer(): Promise<void> {
        console.log('🔧 Starting Motia backend server...');

        return new Promise((resolve, reject) => {
            this.backendProcess = spawn('npm', ['run', 'dev'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: process.env,
                detached: false
            });

            let output = '';
            let errorOutput = '';

            this.backendProcess.stdout?.on('data', (data) => {
                const text = data.toString();
                output += text;
                
                // Look for server ready indicators
                if (text.includes('Server running') || 
                    text.includes('listening') || 
                    text.includes('ready')) {
                    resolve();
                }
            });

            this.backendProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });

            this.backendProcess.on('error', (error) => {
                reject(new Error(`Backend startup failed: ${error.message}`));
            });

            this.backendProcess.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Backend exited with code ${code}. Error: ${errorOutput}`));
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                reject(new Error('Backend startup timeout. Output: ' + output));
            }, 30000);
        });
    }

    private async waitForBackendReady(): Promise<void> {
        console.log('⏳ Waiting for backend to be ready...');

        const maxAttempts = 30;
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`http://localhost:${this.config.backendPort}/api/health`);
                if (response.ok) {
                    console.log('✅ Backend is ready');
                    return;
                }
            } catch (error) {
                // Backend not ready yet, continue waiting
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        throw new Error('Backend failed to become ready within timeout period');
    }

    private async runIntegrationTests(): Promise<void> {
        console.log('🧪 Running integration tests...');

        return new Promise((resolve, reject) => {
            const testProcess = spawn('npm', ['run', 'test:integration'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: process.env
            });

            let testOutput = '';
            let testErrors = '';

            testProcess.stdout?.on('data', (data) => {
                const text = data.toString();
                testOutput += text;
                process.stdout.write(text); // Show test output in real-time
            });

            testProcess.stderr?.on('data', (data) => {
                const text = data.toString();
                testErrors += text;
                process.stderr.write(text);
            });

            testProcess.on('close', (code) => {
                // Parse test results from output
                this.parseTestResults(testOutput);

                if (code === 0) {
                    console.log('✅ All integration tests passed');
                    resolve();
                } else {
                    console.log('❌ Some integration tests failed');
                    this.testResults.errors.push(`Test process exited with code ${code}`);
                    resolve(); // Don't reject, we want to see the results
                }
            });

            testProcess.on('error', (error) => {
                reject(new Error(`Test execution failed: ${error.message}`));
            });

            // Set timeout for test execution
            setTimeout(() => {
                testProcess.kill('SIGTERM');
                reject(new Error('Test execution timeout'));
            }, this.config.testTimeout);
        });
    }

    private parseTestResults(output: string): void {
        // Parse Mocha test output to extract results
        const lines = output.split('\n');
        
        for (const line of lines) {
            if (line.includes('passing')) {
                const match = line.match(/(\d+) passing/);
                if (match) {
                    this.testResults.passed = parseInt(match[1]);
                }
            }
            
            if (line.includes('failing')) {
                const match = line.match(/(\d+) failing/);
                if (match) {
                    this.testResults.failed = parseInt(match[1]);
                }
            }
            
            if (line.includes('pending')) {
                const match = line.match(/(\d+) pending/);
                if (match) {
                    this.testResults.skipped = parseInt(match[1]);
                }
            }
        }
    }

    private generateTestReport(): void {
        console.log('\n📊 Integration Test Results');
        console.log('=' .repeat(40));
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`⏭️  Skipped: ${this.testResults.skipped}`);
        
        if (this.testResults.errors.length > 0) {
            console.log('\n🚨 Errors:');
            this.testResults.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }

        const total = this.testResults.passed + this.testResults.failed + this.testResults.skipped;
        const successRate = total > 0 ? (this.testResults.passed / total * 100).toFixed(1) : '0';
        
        console.log(`\n📈 Success Rate: ${successRate}%`);
        
        // Write detailed report to file
        const reportPath = path.join('tests/integration/logs', `test-report-${Date.now()}.json`);
        const report = {
            timestamp: new Date().toISOString(),
            results: this.testResults,
            config: this.config,
            successRate: parseFloat(successRate)
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);
    }

    private async cleanup(): Promise<void> {
        console.log('\n🧹 Cleaning up...');

        // Stop backend server
        if (this.backendProcess) {
            this.backendProcess.kill('SIGTERM');
            
            // Wait for graceful shutdown
            await new Promise(resolve => {
                this.backendProcess!.on('exit', resolve);
                setTimeout(() => {
                    this.backendProcess!.kill('SIGKILL');
                    resolve(undefined);
                }, 5000);
            });
        }

        // Cleanup test files if configured
        if (this.config.cleanupOnExit) {
            const tempDir = 'tests/integration/temp';
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }

        console.log('✅ Cleanup complete');
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const config: Partial<TestRunnerConfig> = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];

        switch (key) {
            case '--port':
                config.backendPort = parseInt(value);
                break;
            case '--timeout':
                config.testTimeout = parseInt(value) * 1000; // Convert to milliseconds
                break;
            case '--no-cleanup':
                config.cleanupOnExit = false;
                break;
        }
    }

    const runner = new IntegrationTestRunner(config);
    const success = await runner.run();

    process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { IntegrationTestRunner };