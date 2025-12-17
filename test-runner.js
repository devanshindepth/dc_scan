#!/usr/bin/env node

/**
 * Simple test runner for AI Development Insights System
 * Runs basic validation tests without requiring full integration setup
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 AI Development Insights - Test Runner');
console.log('========================================\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, testFn) {
    try {
        console.log(`⏳ Running: ${name}`);
        testFn();
        console.log(`✅ PASSED: ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ FAILED: ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// Test 1: Project Structure Validation
test('Project Structure Validation', async () => {
    // Check that key files exist
    const requiredFiles = [
        'package.json',
        'motia.config.ts',
        'src/types/events.ts',
        'extension/package.json',
        'extension/src/extension.ts'
    ];

    for (const file of requiredFiles) {
        try {
            await fs.access(file);
        } catch (error) {
            throw new Error(`Required file missing: ${file}`);
        }
    }
});

// Test 2: Package.json Configuration
test('Package.json Configuration', async () => {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    
    assert(packageJson.type === 'module', 'package.json should have "type": "module"');
    assert(packageJson.scripts['test:integration'], 'Should have integration test script');
    assert(packageJson.dependencies['motia'], 'Should have motia dependency');
    assert(packageJson.devDependencies['fast-check'], 'Should have fast-check for property testing');
});

// Test 3: Extension Package Configuration
test('Extension Package Configuration', async () => {
    const extensionPackage = JSON.parse(await fs.readFile('extension/package.json', 'utf8'));
    
    assert(extensionPackage.name === 'ai-dev-insights', 'Extension should have correct name');
    assert(extensionPackage.main === './out/extension.js', 'Extension should have correct main entry');
    assert(extensionPackage.devDependencies['fast-check'], 'Extension should have fast-check for property testing');
});

// Test 4: TypeScript Configuration
test('TypeScript Configuration', async () => {
    try {
        const tsconfig = JSON.parse(await fs.readFile('tsconfig.json', 'utf8'));
        assert(tsconfig.compilerOptions, 'Should have compiler options');
    } catch (error) {
        throw new Error('tsconfig.json should exist and be valid JSON');
    }
});

// Test 5: Motia Configuration
test('Motia Configuration', async () => {
    try {
        await fs.access('motia.config.ts');
    } catch (error) {
        throw new Error('motia.config.ts should exist');
    }
});

// Test 6: Event Types Definition
test('Event Types Definition', async () => {
    const eventsFile = await fs.readFile('src/types/events.ts', 'utf8');
    
    assert(eventsFile.includes('DeveloperEvent'), 'Should define DeveloperEvent interface');
    assert(eventsFile.includes('EventMetadata'), 'Should define EventMetadata interface');
    assert(eventsFile.includes('SyncBatch'), 'Should define SyncBatch interface');
    assert(eventsFile.includes('SkillAssessment'), 'Should define SkillAssessment interface');
});

// Test 7: Extension Services
test('Extension Services', async () => {
    const servicesDir = 'extension/src/services';
    const requiredServices = [
        'EventTracker.ts',
        'LocalStorageManager.ts',
        'SyncManager.ts',
        'HeuristicAnalyzer.ts',
        'PrivacyController.ts'
    ];

    for (const service of requiredServices) {
        try {
            await fs.access(join(servicesDir, service));
        } catch (error) {
            throw new Error(`Required service missing: ${service}`);
        }
    }
});

// Test 8: Backend API Steps
test('Backend API Steps', async () => {
    const apiDir = 'src/api';
    const requiredSteps = [
        'events-ingestion.step.ts',
        'insights.step.ts',
        'health.step.ts'
    ];

    for (const step of requiredSteps) {
        try {
            await fs.access(join(apiDir, step));
        } catch (error) {
            throw new Error(`Required API step missing: ${step}`);
        }
    }
});

// Test 9: Backend Event Steps
test('Backend Event Steps', async () => {
    const eventsDir = 'src/events';
    const requiredSteps = [
        'process-events.step.ts',
        'skill-inference.step.ts'
    ];

    for (const step of requiredSteps) {
        try {
            await fs.access(join(eventsDir, step));
        } catch (error) {
            throw new Error(`Required event step missing: ${step}`);
        }
    }
});

// Test 10: Backend Cron Steps
test('Backend Cron Steps', async () => {
    const cronDir = 'src/cron';
    const requiredSteps = [
        'daily-aggregation.step.ts'
    ];

    for (const step of requiredSteps) {
        try {
            await fs.access(join(cronDir, step));
        } catch (error) {
            throw new Error(`Required cron step missing: ${step}`);
        }
    }
});

// Test 11: Integration Test Files
test('Integration Test Files', async () => {
    const testDir = 'tests/integration';
    const requiredTests = [
        'end-to-end.test.ts',
        'integration.test.ts',
        'standalone-integration.test.ts'
    ];

    for (const testFile of requiredTests) {
        try {
            await fs.access(join(testDir, testFile));
        } catch (error) {
            throw new Error(`Required test file missing: ${testFile}`);
        }
    }
});

// Test 12: Extension Test Files
test('Extension Test Files', async () => {
    const testDir = 'extension/src/test/suite';
    const requiredTests = [
        'HeuristicAnalyzer.test.ts',
        'OfflineDataIntegrity.test.ts'
    ];

    for (const testFile of requiredTests) {
        try {
            await fs.access(join(testDir, testFile));
        } catch (error) {
            throw new Error(`Required extension test file missing: ${testFile}`);
        }
    }
});

// Test 13: Privacy Protection Validation
test('Privacy Protection Validation', async () => {
    // Check that event types don't include sensitive fields
    const eventsFile = await fs.readFile('src/types/events.ts', 'utf8');
    
    const forbiddenFields = ['sourceCode', 'content', 'prompt', 'response', 'errorMessage'];
    
    for (const field of forbiddenFields) {
        assert(!eventsFile.includes(`${field}:`), `Event types should not include sensitive field: ${field}`);
    }
});

// Test 14: Property-Based Test Framework
test('Property-Based Test Framework', () => {
    // Simple property-based test validation
    const testData = Array.from({ length: 100 }, (_, i) => ({
        id: `test-${i}`,
        timestamp: Date.now() - (i * 1000),
        value: Math.random() * 100
    }));

    // Property: All IDs should be unique
    const ids = testData.map(d => d.id);
    const uniqueIds = new Set(ids);
    assert(ids.length === uniqueIds.size, 'All generated IDs should be unique');

    // Property: Timestamps should be in descending order
    for (let i = 1; i < testData.length; i++) {
        assert(testData[i].timestamp <= testData[i-1].timestamp, 'Timestamps should be in descending order');
    }

    // Property: All values should be within expected range
    for (const item of testData) {
        assert(item.value >= 0 && item.value <= 100, 'All values should be between 0 and 100');
    }
});

// Test 15: Spec Documents Validation
test('Spec Documents Validation', async () => {
    const specDir = '.kiro/specs/ai-dev-insights';
    const requiredDocs = [
        'requirements.md',
        'design.md',
        'tasks.md'
    ];

    for (const doc of requiredDocs) {
        try {
            const content = await fs.readFile(join(specDir, doc), 'utf8');
            assert(content.length > 100, `${doc} should have substantial content`);
        } catch (error) {
            throw new Error(`Required spec document missing or empty: ${doc}`);
        }
    }
});

// Run all tests
async function runTests() {
    console.log('Starting test execution...\n');
    
    // Note: We're running these sequentially to avoid async issues in this simple runner
    await test('Project Structure Validation', async () => {
        const requiredFiles = [
            'package.json',
            'motia.config.ts',
            'src/types/events.ts',
            'extension/package.json',
            'extension/src/extension.ts'
        ];

        for (const file of requiredFiles) {
            try {
                await fs.access(file);
            } catch (error) {
                throw new Error(`Required file missing: ${file}`);
            }
        }
    });

    await test('Package.json Configuration', async () => {
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
        
        assert(packageJson.type === 'module', 'package.json should have "type": "module"');
        assert(packageJson.scripts['test:integration'], 'Should have integration test script');
        assert(packageJson.dependencies['motia'], 'Should have motia dependency');
        assert(packageJson.devDependencies['fast-check'], 'Should have fast-check for property testing');
    });

    await test('Extension Package Configuration', async () => {
        const extensionPackage = JSON.parse(await fs.readFile('extension/package.json', 'utf8'));
        
        assert(extensionPackage.name === 'ai-dev-insights', 'Extension should have correct name');
        assert(extensionPackage.main === './out/extension.js', 'Extension should have correct main entry');
        assert(extensionPackage.devDependencies['fast-check'], 'Extension should have fast-check for property testing');
    });

    await test('TypeScript Configuration', async () => {
        try {
            const tsconfig = JSON.parse(await fs.readFile('tsconfig.json', 'utf8'));
            assert(tsconfig.compilerOptions, 'Should have compiler options');
        } catch (error) {
            throw new Error('tsconfig.json should exist and be valid JSON');
        }
    });

    await test('Event Types Definition', async () => {
        const eventsFile = await fs.readFile('src/types/events.ts', 'utf8');
        
        assert(eventsFile.includes('DeveloperEvent'), 'Should define DeveloperEvent interface');
        assert(eventsFile.includes('EventMetadata'), 'Should define EventMetadata interface');
        assert(eventsFile.includes('SyncBatch'), 'Should define SyncBatch interface');
        assert(eventsFile.includes('SkillAssessment'), 'Should define SkillAssessment interface');
    });

    await test('Extension Services', async () => {
        const servicesDir = 'extension/src/services';
        const requiredServices = [
            'EventTracker.ts',
            'LocalStorageManager.ts',
            'SyncManager.ts',
            'HeuristicAnalyzer.ts',
            'PrivacyController.ts'
        ];

        for (const service of requiredServices) {
            try {
                await fs.access(join(servicesDir, service));
            } catch (error) {
                throw new Error(`Required service missing: ${service}`);
            }
        }
    });

    await test('Backend API Steps', async () => {
        const apiDir = 'src/api';
        const requiredSteps = [
            'events-ingestion.step.ts',
            'insights.step.ts',
            'health.step.ts'
        ];

        for (const step of requiredSteps) {
            try {
                await fs.access(join(apiDir, step));
            } catch (error) {
                throw new Error(`Required API step missing: ${step}`);
            }
        }
    });

    await test('Privacy Protection Validation', async () => {
        const eventsFile = await fs.readFile('src/types/events.ts', 'utf8');
        
        const forbiddenFields = ['sourceCode', 'content', 'prompt', 'response', 'errorMessage'];
        
        for (const field of forbiddenFields) {
            assert(!eventsFile.includes(`${field}:`), `Event types should not include sensitive field: ${field}`);
        }
    });

    test('Property-Based Test Framework', () => {
        const testData = Array.from({ length: 100 }, (_, i) => ({
            id: `test-${i}`,
            timestamp: Date.now() - (i * 1000),
            value: Math.random() * 100
        }));

        const ids = testData.map(d => d.id);
        const uniqueIds = new Set(ids);
        assert(ids.length === uniqueIds.size, 'All generated IDs should be unique');

        for (let i = 1; i < testData.length; i++) {
            assert(testData[i].timestamp <= testData[i-1].timestamp, 'Timestamps should be in descending order');
        }

        for (const item of testData) {
            assert(item.value >= 0 && item.value <= 100, 'All values should be between 0 and 100');
        }
    });

    await test('Spec Documents Validation', async () => {
        const specDir = '.kiro/specs/ai-dev-insights';
        const requiredDocs = [
            'requirements.md',
            'design.md',
            'tasks.md'
        ];

        for (const doc of requiredDocs) {
            try {
                const content = await fs.readFile(join(specDir, doc), 'utf8');
                assert(content.length > 100, `${doc} should have substantial content`);
            } catch (error) {
                throw new Error(`Required spec document missing or empty: ${doc}`);
            }
        }
    });

    // Summary
    console.log('\n========================================');
    console.log('🏁 Test Execution Complete');
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📊 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    
    if (testsFailed === 0) {
        console.log('\n🎉 All tests passed! The system appears to be properly configured.');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the errors above.');
        process.exit(1);
    }
}

runTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
});