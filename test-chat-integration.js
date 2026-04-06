/**
 * Test file for Multi-Agent Chat Integration
 * Run this to verify the frontend can communicate with the backend
 */

const API_BASE_URL = 'http://localhost:5000';

// Test queries for each agent type
const testQueries = {
    learning: "What is LangChain and how does it work?",
    tutorial: "Create a tutorial on Python decorators",
    resume: "Help me create a resume for a software engineer position",
    interview: "Generate interview questions for a frontend developer role",
    jobSearch: "Find AI jobs in San Francisco"
};

async function testMultiAgentEndpoint(query, type) {
    console.log(`\n🧪 Testing ${type.toUpperCase()} query...`);
    console.log(`Query: "${query}"`);
    
    try {
        const response = await fetch(`${API_BASE_URL}/multi-agent/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log('✅ Success!');
        console.log('Category:', data.category);
        console.log('Response Length:', data.response.length, 'characters');
        console.log('Response Preview:', data.response.substring(0, 150) + '...');
        
        return { success: true, data };
    } catch (error) {
        console.error('❌ Error:', error.message);
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    console.log('🚀 Starting Multi-Agent Chat Integration Tests\n');
    console.log('=' .repeat(60));
    
    const results = [];
    
    for (const [type, query] of Object.entries(testQueries)) {
        const result = await testMultiAgentEndpoint(query, type);
        results.push({ type, ...result });
        
        // Wait 2 seconds between tests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary:');
    console.log('='.repeat(60));
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`\n✅ Passed: ${successCount}/${totalCount}`);
    console.log(`❌ Failed: ${totalCount - successCount}/${totalCount}`);
    
    if (successCount === totalCount) {
        console.log('\n🎉 All tests passed! Multi-agent system is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Check the logs above for details.');
    }
}

// Run tests if executed directly
if (typeof window !== 'undefined') {
    console.log('⚠️  This test should be run in Node.js, not in the browser.');
    console.log('To test from browser console, use:');
    console.log('fetch("http://localhost:5000/multi-agent/chat", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({query: "What is AI?"})}).then(r => r.json()).then(console.log)');
} else {
    runAllTests().catch(console.error);
}

module.exports = { testMultiAgentEndpoint, runAllTests };
