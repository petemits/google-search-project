const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec, spawn } = require('child_process');
require('dotenv').config();

// ==================== CORE SEARCH CLASS ====================
class GoogleSearchAPI {
    constructor() {
        this.apiKey = process.env.GOOGLE_API_KEY;
        this.cseId = process.env.GOOGLE_CSE_ID;
        this.baseURL = 'https://www.googleapis.com/customsearch/v1';
        
        // Create output directory
        this.outputDir = path.join(process.cwd(), 'output');
        this.tempDir = path.join(process.cwd(), 'temp');
        this.ensureDirectories();
        
        this.validateConfig();
        
        // Create readline interface for user input
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Store all search sessions
        this.searchSessions = [];
        this.currentSession = null;
        this.searchCount = 0;
    }

    ensureDirectories() {
        [this.outputDir, this.tempDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(chalk.green(`📁 Created directory: ${dir}`));
            }
        });
    }

    validateConfig() {
        console.log(chalk.blue.bold('🔧 Google Search API Configuration'));
        console.log(chalk.gray('='.repeat(50)));
        
        if (!this.apiKey) {
            console.log(chalk.red('❌ GOOGLE_API_KEY is missing in .env file'));
            process.exit(1);
        }

        if (!this.cseId) {
            console.log(chalk.red('❌ GOOGLE_CSE_ID is missing in .env file'));
            process.exit(1);
        }

        console.log(chalk.green('✅ API Key:'), this.apiKey.substring(0, 20) + '...');
        console.log(chalk.green('✅ CSE ID:'), this.cseId);
        console.log(chalk.green('✅ Configuration validated successfully!\n'));
    }

    // ==================== OPTION 1: ENHANCED SEARCH ====================
    async searchWithMultiplePages(query, minResults = 10) {
        console.log(chalk.blue.bold(`🔍 Searching for at least ${minResults} results: "${query}"`));
        
        let allResults = [];
        let page = 1;
        const resultsPerPage = 10;
        
        try {
            while (allResults.length < minResults) {
                console.log(chalk.gray(`   📄 Fetching page ${page}...`));
                
                const params = {
                    key: this.apiKey,
                    cx: this.cseId,
                    q: query,
                    num: resultsPerPage,
                    start: (page - 1) * resultsPerPage + 1,
                    safe: 'off'
                };

                const response = await axios.get(this.baseURL, { 
                    params,
                    timeout: 10000
                });
                
                const data = response.data;

                if (!data.items || data.items.length === 0) {
                    console.log(chalk.yellow(`   📭 No more results found after ${allResults.length} results`));
                    break;
                }

                const pageResults = data.items.map((item, index) => ({
                    position: allResults.length + index + 1,
                    title: item.title,
                    link: item.link,
                    displayLink: item.displayLink,
                    snippet: item.snippet,
                    formattedUrl: item.formattedUrl,
                    favicon: `https://www.google.com/s2/favicons?domain=${new URL(item.link).hostname}&sz=32`,
                    thumbnail: this.generateThumbnailUrl(item),
                    searchTimestamp: new Date().toISOString(),
                    page: page
                }));

                allResults = [...allResults, ...pageResults];
                console.log(chalk.green(`   ✅ Page ${page}: Found ${pageResults.length} results (Total: ${allResults.length})`));

                if (allResults.length >= minResults || pageResults.length < resultsPerPage) {
                    break;
                }

                page++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const finalResults = {
                query: query,
                totalResults: allResults.length > 0 ? parseInt(allResults[0]?.totalResults) || allResults.length : 0,
                searchTime: 'Multiple requests',
                items: allResults.slice(0, minResults),
                totalPages: page,
                totalFetched: allResults.length
            };

            console.log(chalk.green(`   🎯 Successfully gathered ${finalResults.items.length} results from ${page} pages`));
            return finalResults;

        } catch (error) {
            return this.handleSearchError(error, query);
        }
    }

    generateThumbnailUrl(item) {
        try {
            const domain = new URL(item.link).hostname;
            const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD', '98D8C8'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            return `https://via.placeholder.com/200x150/${color}/FFFFFF?text=${encodeURIComponent(domain.substring(0, 15))}`;
        } catch (error) {
            return `https://via.placeholder.com/200x150/667eea/FFFFFF?text=Website`;
        }
    }

    handleSearchError(error, query) {
        console.error(chalk.red.bold(`\n❌ Error searching for "${query}":`));
        
        if (error.response) {
            const googleError = error.response.data.error;
            console.error(chalk.red(`   Code: ${googleError.code}`));
            console.error(chalk.red(`   Message: ${googleError.message}`));
            
            switch (googleError.code) {
                case 403:
                    if (googleError.message.includes('invalid API key')) {
                        console.error(chalk.yellow('   💡 Solution: Check your GOOGLE_API_KEY in .env file'));
                    } else if (googleError.message.includes('forbidden')) {
                        console.error(chalk.yellow('   💡 Solution: Enable "Custom Search JSON API" in Google Cloud Console'));
                    }
                    break;
                case 429:
                    console.error(chalk.yellow('   💡 Solution: Quota exceeded (100 searches/day free limit)'));
                    break;
                case 400:
                    console.error(chalk.yellow('   💡 Solution: Check your CSE ID or query parameters'));
                    break;
            }
        } else if (error.request) {
            console.error(chalk.red('   🌐 Network error: Cannot connect to Google API'));
        } else {
            console.error(chalk.red('   💻 Error:', error.message));
        }

        return {
            query: query,
            totalResults: 0,
            searchTime: 0,
            items: [],
            error: true
        };
    }

    // ==================== OPTION 2: USER INPUT WITH RESET ====================
    async askForAnotherSearch() {
        this.rl.question(chalk.cyan('\n🔄 Would you like to search for something else? (y/n): '), (answer) => {
            if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
                console.log(chalk.green('\n🔄 Starting new search...'));
                this.searchCount++;
                this.startUserInputSearch();
            } else {
                console.log(chalk.green.bold(`\n🎉 Thank you for using Google Search!`));
                console.log(chalk.gray(`   Total searches performed: ${this.searchCount}`));
                console.log(chalk.gray(`   Check the 'output' folder for all your HTML results`));
                this.rl.close();
            }
        });
    }

    async startUserInputSearch() {
        console.log(chalk.yellow.bold('\n🎯 GOOGLE SEARCH WITH USER INPUT'));
        console.log(chalk.gray('='.repeat(45)));
        console.log(chalk.cyan(`   Search #${this.searchCount + 1} - I'll provide at least 10 results!`));
        console.log(chalk.white('   Type "mode" to switch to code execution'));
        console.log(chalk.gray('─'.repeat(45)));

        this.rl.question(chalk.magenta('\n🔍 What would you like to search for? '), async (query) => {
            if (!query.trim()) {
                console.log(chalk.red('   ❌ Please enter a valid search query'));
                this.askForAnotherSearch();
                return;
            }

            // Check for mode switch
            if (query.toLowerCase() === 'mode') {
                console.log(chalk.blue('🔄 Switching to code execution mode...'));
                this.startCodeExecutionMode();
                return;
            }

            // Check for exit commands
            if (query.toLowerCase() === 'quit' || query.toLowerCase() === 'exit') {
                console.log(chalk.green('👋 Thank you for using Google Search!'));
                this.rl.close();
                return;
            }

            console.log(chalk.blue(`\n🔄 Searching for: "${query}"`));
            console.log(chalk.gray('   Getting at least 10 results...'));

            const results = await this.searchWithMultiplePages(query, 10);

            if (results.error || results.items.length === 0) {
                console.log(chalk.red('   ❌ No results found. Please try a different search term.'));
                this.askForAnotherSearch();
                return;
            }

            this.displayEnhancedResults(results);

            // Generate HTML automatically
            console.log(chalk.cyan('\n📄 Generating HTML report...'));
            const html = this.generateHTMLResponse(results, {
                title: `Search Results: ${query}`,
                theme: 'light'
            });
            
            const filename = `search-${this.searchCount + 1}-${query.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.html`;
            const filepath = this.saveHTMLToFile(html, filename);
            
            console.log(chalk.green(`   ✅ HTML report saved: ${filepath}`));
            
            // Open in Chrome automatically
            console.log(chalk.cyan('   🌐 Opening in Chrome...'));
            this.openInChrome(filepath);
            
            console.log(chalk.green.bold(`\n✅ Search #${this.searchCount + 1} completed!`));
            
            this.searchCount++;
            this.askForAnotherSearch();
        });
    }

    displayEnhancedResults(results) {
        console.log(chalk.green.bold(`\n📊 SEARCH RESULTS FOR: "${results.query}"`));
        console.log(chalk.gray('='.repeat(60)));
        console.log(chalk.white(`   Total Available: ${results.totalResults} results`));
        console.log(chalk.white(`   Displaying: ${results.items.length} results`));
        if (results.totalPages > 1) {
            console.log(chalk.white(`   Pages Fetched: ${results.totalPages}`));
        }
        console.log(chalk.gray('─'.repeat(60)));

        results.items.forEach((item, index) => {
            console.log(chalk.cyan.bold(`\n${item.position}. ${item.title}`));
            console.log(chalk.blue(`   🔗 ${item.link}`));
            console.log(chalk.gray(`   🌐 ${item.displayLink}`));
            
            if (item.snippet) {
                const cleanSnippet = item.snippet.replace(/\n/g, ' ').trim();
                const shortSnippet = cleanSnippet.length > 150 ? cleanSnippet.substring(0, 150) + '...' : cleanSnippet;
                console.log(chalk.white(`   📝 ${shortSnippet}`));
            }
        });

        console.log(chalk.gray('\n─'.repeat(60)));
        console.log(chalk.green(`   ✅ Successfully retrieved ${results.items.length} results`));
    }

    // ==================== OPTION 3: IMPROVED CODE EXECUTION ====================
    async executeJavaScript(code) {
        return new Promise((resolve, reject) => {
            const filename = `temp_${Date.now()}.js`;
            const filepath = path.join(this.tempDir, filename);
            
            // Check if it's a description and generate code
            if (this.looksLikeDescription(code)) {
                const generatedCode = this.generateCodeFromUserInput(code);
                fs.writeFileSync(filepath, generatedCode);
                console.log(chalk.yellow('   💡 Detected description - generated code for you!'));
            } else {
                fs.writeFileSync(filepath, code);
            }
            
            const process = exec(`node "${filepath}"`, (error, stdout, stderr) => {
                try { fs.unlinkSync(filepath); } catch (e) {}
                
                if (error) {
                    // Check if it's a module not found error
                    if (error.message.includes('Cannot find module')) {
                        const moduleName = error.message.match(/Cannot find module '([^']+)'/)?.[1];
                        reject({ 
                            error: `Missing dependency: ${moduleName}. Try a simpler example or install the package first.`,
                            stderr 
                        });
                    } else {
                        reject({ error: error.message, stderr });
                    }
                } else {
                    resolve({ output: stdout, stderr });
                }
            });
            
            setTimeout(() => {
                process.kill();
                reject({ error: 'Execution timeout' });
            }, 10000);
        });
    }

    async executePython(code) {
        return new Promise((resolve, reject) => {
            const filename = `temp_${Date.now()}.py`;
            const filepath = path.join(this.tempDir, filename);
            
            fs.writeFileSync(filepath, code);
            
            const process = exec(`python "${filepath}"`, (error, stdout, stderr) => {
                try { fs.unlinkSync(filepath); } catch (e) {}
                
                if (error) {
                    reject({ error: error.message, stderr });
                } else {
                    resolve({ output: stdout, stderr });
                }
            });
            
            setTimeout(() => {
                process.kill();
                reject({ error: 'Execution timeout' });
            }, 10000);
        });
    }

    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject({ error: error.message, stderr });
                } else {
                    resolve({ output: stdout, stderr });
                }
            });
        });
    }

    looksLikeDescription(input) {
        // Check if input looks like a description rather than code
        const descriptionIndicators = [
            'send email', 'email', 'web server', 'file', 'read file',
            'api', 'fetch data', 'process data', 'calculate', 'how to',
            'code for', 'script for', 'function for'
        ];
        
        const lowerInput = input.toLowerCase();
        return descriptionIndicators.some(indicator => lowerInput.includes(indicator)) ||
               !input.includes('{') && !input.includes('(') && !input.includes(';') &&
               input.split(' ').length > 3;
    }

    generateCodeFromUserInput(description) {
        const lowerDesc = description.toLowerCase();
        
        if (lowerDesc.includes('email') || lowerDesc.includes('send email')) {
            return `// Simple email simulation (no external dependencies needed)
console.log('📧 SIMULATED EMAIL SENDING');
console.log('==========================');
console.log('From: test@sender.com');
console.log('To: recipient@example.com');
console.log('Subject: Test Email from Node.js');
console.log('Body: This is a simulated email message!');
console.log('');
console.log('💡 To send real emails:');
console.log('1. Install: npm install nodemailer');
console.log('2. Configure email service credentials');
console.log('3. Use the nodemailer library');
console.log('');
console.log('✅ Email simulation completed successfully!');
`;
        } else if (lowerDesc.includes('web server')) {
            return `// Simple web server example (built-in modules only)
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`
        <html>
            <head><title>My Server</title></head>
            <body>
                <h1>Hello from Node.js Server! 🚀</h1>
                <p>Server is running successfully!</p>
                <p>Request URL: \${req.url}</p>
                <p>Time: \${new Date().toISOString()}</p>
            </body>
        </html>
    \`);
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(\`✅ Server running at http://localhost:\${PORT}\`);
    console.log('Press Ctrl+C to stop the server');
});
`;
        } else if (lowerDesc.includes('file') || lowerDesc.includes('read')) {
            return `// File operations examples (built-in modules only)
const fs = require('fs');
const path = require('path');

console.log('📁 FILE OPERATIONS DEMO');
console.log('=======================');

// Example 1: Read current directory
console.log('Current directory files:');
try {
    const files = fs.readdirSync('.');
    files.forEach(file => {
        const stats = fs.statSync(file);
        console.log(\`  - \${file} (\${stats.isDirectory() ? 'DIR' : 'FILE'})\`);
    });
} catch (err) {
    console.error('Error reading directory:', err.message);
}

// Example 2: Create and read a file
const sampleContent = 'Hello, this is a sample file!\\nCreated at: ' + new Date().toISOString();

try {
    fs.writeFileSync('example.txt', sampleContent);
    console.log('✅ File "example.txt" created successfully!');
    
    // Read the file back
    const data = fs.readFileSync('example.txt', 'utf8');
    console.log('📖 File content:');
    console.log(data);
} catch (err) {
    console.error('Error with file operations:', err.message);
}
`;
        } else if (lowerDesc.includes('api') || lowerDesc.includes('fetch')) {
            return `// API simulation (no external dependencies needed)
console.log('🌐 API REQUEST SIMULATION');
console.log('=========================');
console.log('Making request to: https://api.example.com/data');
console.log('');

// Simulate API response
setTimeout(() => {
    const mockResponse = {
        status: 'success',
        data: {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            timestamp: new Date().toISOString()
        }
    };
    
    console.log('✅ API Response received:');
    console.log(JSON.stringify(mockResponse, null, 2));
    console.log('');
    console.log('💡 For real API calls:');
    console.log('1. Install: npm install axios');
    console.log('2. Use: const axios = require("axios")');
    console.log('3. Make actual HTTP requests');
}, 1000);
`;
        } else if (lowerDesc.includes('calculator') || lowerDesc.includes('calculate')) {
            return `// Simple calculator (no dependencies needed)
console.log('🧮 CALCULATOR DEMO');
console.log('==================');

function calculate(a, b, operation) {
    switch (operation) {
        case 'add': return a + b;
        case 'subtract': return a - b;
        case 'multiply': return a * b;
        case 'divide': return b !== 0 ? a / b : 'Error: Division by zero';
        default: return 'Invalid operation';
    }
}

// Test calculations
console.log('5 + 3 =', calculate(5, 3, 'add'));
console.log('10 - 4 =', calculate(10, 4, 'subtract'));
console.log('6 * 7 =', calculate(6, 7, 'multiply'));
console.log('15 / 3 =', calculate(15, 3, 'divide'));
console.log('5 / 0 =', calculate(5, 0, 'divide'));
`;
        } else {
            // Default template for unknown descriptions
            return `// Generated code for: "${description}"
console.log('🚀 Hello! I generated this code based on your description.');
console.log('You asked for: "${description}"');
console.log('');
console.log('Here are some working examples:');

// Example 1: Basic operations
console.log('1. Basic Math:');
console.log('   2 + 2 =', 2 + 2);
console.log('   10 * 5 =', 10 * 5);

// Example 2: String operations
console.log('2. String Operations:');
const name = 'Node.js';
console.log('   Hello ' + name + '!');
console.log('   Length of name:', name.length);

// Example 3: Array operations
console.log('3. Array Operations:');
const fruits = ['apple', 'banana', 'orange'];
console.log('   Fruits:', fruits);
console.log('   First fruit:', fruits[0]);

// Example 4: Current time
console.log('4. Current Time:');
console.log('   Now:', new Date().toLocaleString());

console.log('');
console.log('💡 Try these working examples or type "examples" for more!');
`;
        }
    }

    detectLanguage(code) {
        if (code.includes('console.log') || code.includes('require(') || code.includes('function ') || code.includes('const ') || code.includes('let ')) {
            return 'javascript';
        } else if (code.includes('print(') || code.includes('import ') || code.startsWith('def ') || code.startsWith('class ')) {
            return 'python';
        } else if (code.startsWith('npm ') || code.startsWith('git ') || code.includes('cd ') || code.includes('ls ')) {
            return 'shell';
        }
        return 'javascript';
    }

    async executeCode(code, language = 'auto') {
        try {
            console.log(chalk.blue(`🔧 Executing ${language} code...`));
            
            if (language === 'auto') {
                language = this.detectLanguage(code);
            }

            let result;
            switch (language.toLowerCase()) {
                case 'javascript':
                case 'js':
                    result = await this.executeJavaScript(code);
                    break;
                case 'python':
                case 'py':
                    result = await this.executePython(code);
                    break;
                case 'shell':
                case 'bash':
                case 'cmd':
                    result = await this.executeCommand(code);
                    break;
                default:
                    throw new Error(`Unsupported language: ${language}`);
            }

            console.log(chalk.green('✅ Code executed successfully!'));
            return result;
            
        } catch (error) {
            console.log(chalk.red('❌ Code execution failed:'));
            throw error;
        }
    }

    showCodeExamples() {
        console.log(chalk.cyan.bold('\n💡 WORKING CODE EXAMPLES (copy and paste):'));
        console.log(chalk.gray('─'.repeat(50)));
        
        console.log(chalk.white('📝 JavaScript (immediately works):'));
        console.log(chalk.yellow('  console.log("Hello World!");'));
        console.log(chalk.yellow('  for (let i = 0; i < 3; i++) { console.log("Count:", i); }'));
        console.log(chalk.yellow('  const numbers = [1, 2, 3]; console.log("Sum:", numbers.reduce((a, b) => a + b));'));
        
        console.log(chalk.white('🐍 Python (if installed):'));
        console.log(chalk.yellow('  print("Hello from Python!")'));
        console.log(chalk.yellow('  for i in range(3): print(f"Number: {i}")'));
        console.log(chalk.yellow('  numbers = [1, 2, 3]; print("Sum:", sum(numbers))'));
        
        console.log(chalk.white('💻 Shell Commands:'));
        console.log(chalk.yellow('  dir'));
        console.log(chalk.yellow('  echo "Hello from command line"'));
        console.log(chalk.yellow('  node --version'));
        
        console.log(chalk.white('🎯 Try these descriptions:'));
        console.log(chalk.yellow('  "web server"'));
        console.log(chalk.yellow('  "file operations"'));
        console.log(chalk.yellow('  "calculator"'));
        console.log(chalk.yellow('  "api simulation"'));
        
        console.log(chalk.gray('─'.repeat(50)));
    }

    async startCodeExecutionMode() {
        console.log(chalk.yellow.bold('\n💻 CODE EXECUTION MODE'));
        console.log(chalk.gray('='.repeat(40)));
        console.log(chalk.cyan('   I can execute JavaScript, Python, and shell commands!'));
        console.log(chalk.white('   Type actual code OR describe what you want'));
        console.log(chalk.white('   Type "examples" to see working code examples'));
        console.log(chalk.white('   Type "mode" to switch back to search'));
        console.log(chalk.gray('─'.repeat(40)));

        const askForCode = () => {
            this.rl.question(chalk.magenta('\n💻 Enter your code or description: '), async (input) => {
                if (input.trim().toLowerCase() === 'mode') {
                    console.log(chalk.blue('🔄 Switching to search mode...'));
                    this.startUserInputSearch();
                    return;
                }

                if (input.trim().toLowerCase() === 'examples') {
                    this.showCodeExamples();
                    askForCode();
                    return;
                }

                if (input.trim().toLowerCase() === 'quit' || input.trim().toLowerCase() === 'exit') {
                    console.log(chalk.green('👋 Thank you for using the app!'));
                    this.rl.close();
                    return;
                }

                if (!input.trim()) {
                    console.log(chalk.yellow('   Please enter some code or a description.'));
                    askForCode();
                    return;
                }

                try {
                    console.log(chalk.blue('\n🔄 Executing...'));
                    
                    const result = await this.executeCode(input);
                    
                    console.log(chalk.green.bold('\n📤 OUTPUT:'));
                    console.log(chalk.white(result.output));
                    
                    if (result.stderr) {
                        console.log(chalk.yellow.bold('\n⚠️  ERRORS:'));
                        console.log(chalk.yellow(result.stderr));
                    }
                    
                } catch (error) {
                    console.log(chalk.red.bold('\n❌ EXECUTION ERROR:'));
                    if (error.error && error.error.includes('Missing dependency')) {
                        console.log(chalk.yellow('   ' + error.error));
                        console.log(chalk.cyan('   💡 Try a simpler example or use descriptions like "web server"'));
                    } else {
                        console.log(chalk.red(error.error || error.message));
                    }
                    if (error.stderr) {
                        console.log(chalk.yellow(error.stderr));
                    }
                }

                askForCode();
            });
        };

        askForCode();
    }

    // ==================== OPTION 4: AI CODE GENERATION ====================
    generateCodeFromDescription(description) {
        const templates = {
            'web server': `const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`
        <html>
            <head><title>My Server</title></head>
            <body>
                <h1>Hello from Node.js Server! 🚀</h1>
                <p>Request URL: \${req.url}</p>
            </body>
        </html>
    \`);
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(\`Server running at http://localhost:\${PORT}\`);
});`,

            'file reader': `const fs = require('fs');

function readFile(filename) {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        console.log('File content:', data);
        return data;
    } catch (error) {
        console.error('Error reading file:', error.message);
    }
}`,

            'calculator': `function calculate(a, b, operation) {
    switch (operation) {
        case 'add': return a + b;
        case 'subtract': return a - b;
        case 'multiply': return a * b;
        case 'divide': return b !== 0 ? a / b : 'Error: Division by zero';
        default: return 'Invalid operation';
    }
}

// Examples
console.log('5 + 3 =', calculate(5, 3, 'add'));
console.log('10 / 2 =', calculate(10, 2, 'divide'));`
        };

        const lowerDesc = description.toLowerCase();
        for (const [key, code] of Object.entries(templates)) {
            if (lowerDesc.includes(key)) {
                return { code, language: 'javascript', template: key };
            }
        }

        const defaultCode = `// Generated code for: "${description}"
console.log('Hello! This is a generated code template.');
console.log('You requested: "${description}"');

function main() {
    return "Implementation for: ${description}";
}

console.log(main());`;

        return { code: defaultCode, language: 'javascript', template: 'custom' };
    }

    async startAICodeGeneration() {
        console.log(chalk.yellow.bold('\n🤖 AI CODE GENERATION MODE'));
        console.log(chalk.gray('='.repeat(40)));
        console.log(chalk.cyan('   Describe what code you want, and I will generate it!'));
        console.log(chalk.white('   Examples: "web server", "file reader", "calculator"'));
        console.log(chalk.gray('─'.repeat(40)));

        this.rl.question(chalk.magenta('\n🤖 Describe the code you want: '), async (description) => {
            if (!description.trim()) {
                console.log(chalk.red('   Please describe what code you want to generate.'));
                this.rl.close();
                return;
            }

            if (description.toLowerCase() === 'quit' || description.toLowerCase() === 'exit') {
                console.log(chalk.green('👋 Thank you for using the app!'));
                this.rl.close();
                return;
            }

            try {
                console.log(chalk.blue(`🤖 Generating code for: "${description}"`));
                
                const { code, language, template } = this.generateCodeFromDescription(description);
                
                console.log(chalk.green(`📝 Generated ${language} code (template: ${template})`));
                console.log(chalk.gray('─'.repeat(50)));
                console.log(chalk.white(code));
                console.log(chalk.gray('─'.repeat(50)));
                
                this.rl.question(chalk.cyan('\n🚀 Execute this code? (y/n): '), async (answer) => {
                    if (answer.trim().toLowerCase() === 'y') {
                        try {
                            const result = await this.executeCode(code, language);
                            console.log(chalk.green.bold('\n📤 EXECUTION OUTPUT:'));
                            console.log(chalk.white(result.output));
                        } catch (error) {
                            console.log(chalk.red('❌ Execution failed:'), error.error);
                        }
                    } else {
                        console.log(chalk.yellow('💡 Code generated but not executed.'));
                    }
                    
                    this.rl.close();
                });
                
            } catch (error) {
                console.log(chalk.red('❌ Code generation failed:'), error.message);
                this.rl.close();
            }
        });
    }

    // ==================== HTML GENERATION ====================
    generateHTMLResponse(results, options = {}) {
        const {
            title = 'Google Search Results',
            theme = 'light',
            includeCSS = true
        } = options;

        if (!results || results.error || results.items.length === 0) {
            return this.generateNoResultsHTML(results?.query);
        }

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - "${results.query}"</title>
    ${includeCSS ? this.getCSS(theme) : ''}
</head>
<body>
    <div class="container">
        <header class="search-header">
            <h1>🔍 Google Search Results</h1>
            <div class="search-info">
                <p><strong>Query:</strong> "${results.query}"</p>
                <p><strong>Found:</strong> ${results.items.length} of ${results.totalResults} results</p>
                <p><strong>Search #:</strong> ${this.searchCount + 1}</p>
            </div>
        </header>

        <div class="results-container">
            ${results.items.map(item => this.generateResultHTML(item)).join('')}
        </div>

        <footer class="search-footer">
            <p>Generated by Super Search API • ${new Date().toLocaleString()}</p>
        </footer>
    </div>
</body>
</html>`;
        return html;
    }

    generateResultHTML(item) {
        return `
<div class="search-result">
    <div class="result-header">
        <img src="${item.favicon}" alt="Favicon" class="favicon" onerror="this.style.display='none'">
        <span class="result-position">#${item.position}</span>
        <a href="${item.link}" class="result-link" target="_blank">${item.displayLink}</a>
    </div>
    
    <div class="result-content">
        <div class="result-text">
            <h3 class="result-title">
                <a href="${item.link}" target="_blank">${item.title}</a>
            </h3>
            <p class="result-snippet">${item.snippet}</p>
        </div>
        
        <div class="result-visual">
            <img src="${item.thumbnail}" alt="Preview" class="result-thumbnail" 
                 onerror="this.style.display='none'">
            <div class="result-actions">
                <a href="${item.link}" class="visit-btn" target="_blank">Visit Site</a>
                <button class="copy-btn" onclick="copyToClipboard('${item.link.replace(/'/g, "\\'")}')">Copy Link</button>
            </div>
        </div>
    </div>
</div>`;
    }

    getCSS(theme) {
        const isDark = theme === 'dark';
        const bgColor = isDark ? '#1a1a1a' : '#ffffff';
        const textColor = isDark ? '#ffffff' : '#333333';
        const cardBg = isDark ? '#2d2d2d' : '#f8f9fa';
        const borderColor = isDark ? '#444444' : '#e0e0e0';

        return `
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${bgColor}; color: ${textColor}; line-height: 1.6; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .search-header { background: ${cardBg}; padding: 30px; border-radius: 12px; margin-bottom: 30px; border: 1px solid ${borderColor}; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .search-header h1 { font-size: 2.5em; margin-bottom: 15px; color: ${isDark ? '#4ECDC4' : '#1a73e8'}; }
        .search-info { display: flex; gap: 30px; flex-wrap: wrap; }
        .search-info p { margin: 5px 0; font-size: 1.1em; }
        .results-container { display: flex; flex-direction: column; gap: 20px; }
        .search-result { background: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 25px; transition: all 0.3s ease; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .search-result:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .result-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
        .favicon { width: 16px; height: 16px; border-radius: 2px; }
        .result-position { background: ${isDark ? '#4ECDC4' : '#1a73e8'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; }
        .result-link { color: ${isDark ? '#88c999' : '#0d652d'}; text-decoration: none; font-size: 0.9em; }
        .result-link:hover { text-decoration: underline; }
        .result-content { display: grid; grid-template-columns: 1fr auto; gap: 25px; align-items: start; }
        .result-text { flex: 1; }
        .result-title { margin-bottom: 10px; }
        .result-title a { color: ${isDark ? '#4ECDC4' : '#1a0dab'}; text-decoration: none; font-size: 1.3em; font-weight: normal; }
        .result-title a:hover { text-decoration: underline; }
        .result-snippet { color: ${isDark ? '#cccccc' : '#4d5156'}; line-height: 1.5; }
        .result-visual { display: flex; flex-direction: column; gap: 10px; min-width: 200px; }
        .result-thumbnail { width: 200px; height: 150px; border-radius: 8px; object-fit: cover; border: 1px solid ${borderColor}; }
        .result-actions { display: flex; gap: 8px; }
        .visit-btn, .copy-btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 0.9em; transition: all 0.2s ease; flex: 1; text-align: center; }
        .visit-btn { background: ${isDark ? '#4ECDC4' : '#1a73e8'}; color: white; }
        .visit-btn:hover { background: ${isDark ? '#45b7af' : '#1669c1'}; }
        .copy-btn { background: ${isDark ? '#555' : '#f1f3f4'}; color: ${textColor}; border: 1px solid ${borderColor}; }
        .copy-btn:hover { background: ${isDark ? '#666' : '#e8eaed'}; }
        .search-footer { text-align: center; margin-top: 40px; padding: 20px; color: ${isDark ? '#888' : '#666'}; border-top: 1px solid ${borderColor}; }
        @media (max-width: 768px) { .result-content { grid-template-columns: 1fr; } .result-visual { align-items: center; } .search-info { flex-direction: column; gap: 10px; } }
    </style>
    <script>
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Link copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy: ', err);
            });
        }
    </script>`;
    }

    generateNoResultsHTML(query) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>No Results - "${query}"</title>
    ${this.getCSS('light')}
</head>
<body>
    <div class="container">
        <header class="search-header">
            <h1>🔍 Search Results</h1>
            <div class="search-info">
                <p><strong>Query:</strong> "${query}"</p>
                <p><strong>Found:</strong> 0 results</p>
            </div>
        </header>
        <div class="no-results" style="text-align: center; padding: 40px;">
            <h2>No results found for "${query}"</h2>
            <p>Try adjusting your search terms or try a different query.</p>
        </div>
    </div>
</body>
</html>`;
    }

    saveHTMLToFile(html, filename = null) {
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            filename = `search-results-${timestamp}.html`;
        }

        const filepath = path.join(this.outputDir, filename);
        fs.writeFileSync(filepath, html);
        
        console.log(chalk.green(`📁 HTML saved to: ${filepath}`));
        
        return filepath;
    }

    openInChrome(filepath) {
        const { exec } = require('child_process');
        const platform = process.platform;
        
        let command;
        switch (platform) {
            case 'darwin': command = `open -a "Google Chrome" "${filepath}"`; break;
            case 'win32': command = `start chrome "${filepath}"`; break;
            case 'linux': command = `google-chrome "${filepath}"`; break;
            default:
                console.log(chalk.yellow(`   🌐 Open this file in Chrome: ${filepath}`));
                return;
        }
        
        exec(command, (error) => {
            if (error) {
                console.log(chalk.yellow(`   🌐 Open this file manually in Chrome: ${filepath}`));
            } else {
                console.log(chalk.green('   🌐 Opened in Chrome successfully!'));
            }
        });
    }

    close() {
        if (this.rl) {
            this.rl.close();
        }
    }
}

// ==================== MAIN APPLICATION ====================
async function runMainApp() {
    const searchAPI = new GoogleSearchAPI();
    
    console.log(chalk.yellow.bold('\n🚀 SUPER SEARCH APPLICATION'));
    console.log(chalk.gray('='.repeat(40)));
    console.log(chalk.cyan('   Choose your mode:'));
    console.log(chalk.white('   1. 🔍 Search Mode (Google Search + HTML + Chrome)'));
    console.log(chalk.white('   2. 💻 Code Execution Mode (Run JS/Python/Shell)'));
    console.log(chalk.white('   3. 🤖 AI Code Generation (Describe → Generate → Run)'));
    console.log(chalk.gray('─'.repeat(40)));

    searchAPI.rl.question(chalk.magenta('Select mode (1/2/3 or Enter for Search): '), (choice) => {
        switch (choice.trim()) {
            case '2':
                searchAPI.startCodeExecutionMode();
                break;
            case '3':
                searchAPI.startAICodeGeneration();
                break;
            case '1':
            default:
                searchAPI.startUserInputSearch();
                break;
        }
    });
}

// ==================== COMMAND LINE INTERFACE ====================
async function main() {
    const args = process.argv.slice(2);
    
    try {
        if (args.length === 0) {
            await runMainApp();
        } else if (args[0] === 'search') {
            const searchAPI = new GoogleSearchAPI();
            if (args.length > 1) {
                const query = args.slice(1).join(' ');
                const results = await searchAPI.searchWithMultiplePages(query, 10);
                if (results.items.length > 0) {
                    searchAPI.displayEnhancedResults(results);
                    const html = searchAPI.generateHTMLResponse(results);
                    const filename = `search-${query.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.html`;
                    searchAPI.saveHTMLToFile(html, filename);
                    searchAPI.openInChrome(path.join(searchAPI.outputDir, filename));
                }
            } else {
                searchAPI.startUserInputSearch();
            }
        } else if (args[0] === 'code') {
            const searchAPI = new GoogleSearchAPI();
            searchAPI.startCodeExecutionMode();
        } else if (args[0] === 'ai') {
            const searchAPI = new GoogleSearchAPI();
            searchAPI.startAICodeGeneration();
        } else if (args[0] === 'demo') {
            const searchAPI = new GoogleSearchAPI();
            console.log(chalk.magenta('Running demo search...'));
            const results = await searchAPI.searchWithMultiplePages('artificial intelligence', 5);
            searchAPI.displayEnhancedResults(results);
            searchAPI.close();
        } else {
            console.log(chalk.cyan.bold('\n🎯 SUPER SEARCH - Usage Guide'));
            console.log(chalk.gray('='.repeat(40)));
            console.log(chalk.white('\nCommands:'));
            console.log('  npm start                 - Interactive mode selector');
            console.log('  npm run search [query]    - Direct search');
            console.log('  npm run code              - Code execution mode');
            console.log('  npm run ai                - AI code generation');
            console.log('  npm run demo              - Demo search');
            console.log(chalk.white('\nFeatures:'));
            console.log('  • Google Search with 10+ results');
            console.log('  • Auto HTML generation + Chrome opening');
            console.log('  • Code execution (JS/Python/Shell)');
            console.log('  • AI code generation from descriptions');
            console.log('  • Mode switching during operation');
        }
    } catch (error) {
        console.error(chalk.red.bold('💥 Fatal error:'), error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n👋 Goodbye!'));
    process.exit(0);
});

if (require.main === module) {
    main().catch(error => {
        console.error(chalk.red.bold('💥 Unhandled error:'), error);
        process.exit(1);
    });
}

module.exports = GoogleSearchAPI;