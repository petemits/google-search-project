const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

class GoogleSearchAPI {
    constructor() {
        this.apiKey = process.env.GOOGLE_API_KEY;
        this.cseId = process.env.GOOGLE_CSE_ID;
        this.baseURL = 'https://www.googleapis.com/customsearch/v1';
        
        // Create output directory
        this.outputDir = path.join(process.cwd(), 'output');
        this.ensureOutputDir();
        
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

    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
            console.log(chalk.green(`📁 Created output directory: ${this.outputDir}`));
        }
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
        console.log(chalk.green('✅ Output Directory:'), this.outputDir);
        console.log(chalk.green('✅ Configuration validated successfully!\n'));
    }

    async search(query, options = {}) {
        const {
            numResults = 10,
            page = 1,
            safeSearch = 'off'
        } = options;

        try {
            console.log(chalk.blue.bold(`🔍 Searching: "${query}"`));
            
            const params = {
                key: this.apiKey,
                cx: this.cseId,
                q: query,
                num: Math.min(numResults, 10),
                start: (page - 1) * numResults + 1,
                safe: safeSearch
            };

            const response = await axios.get(this.baseURL, { 
                params,
                timeout: 10000
            });
            
            const data = response.data;

            if (!data.items || data.items.length === 0) {
                console.log(chalk.yellow('   📭 No results found'));
                return {
                    query: query,
                    totalResults: 0,
                    searchTime: data.searchInformation?.searchTime || 0,
                    items: []
                };
            }

            const results = {
                query: query,
                totalResults: parseInt(data.searchInformation.totalResults) || 0,
                searchTime: data.searchInformation.searchTime || 0,
                items: data.items.map((item, index) => ({
                    position: index + 1,
                    title: item.title,
                    link: item.link,
                    displayLink: item.displayLink,
                    snippet: item.snippet,
                    formattedUrl: item.formattedUrl,
                    favicon: `https://www.google.com/s2/favicons?domain=${new URL(item.link).hostname}&sz=32`,
                    thumbnail: this.generateThumbnailUrl(item),
                    searchTimestamp: new Date().toISOString()
                }))
            };

            console.log(chalk.green(`   ✅ Found ${results.items.length} results`));
            console.log(chalk.gray(`   ⏱️  Search time: ${results.searchTime} seconds`));

            return results;

        } catch (error) {
            return this.handleSearchError(error, query);
        }
    }

    // Enhanced search to get at least 10 results
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

    // 🆕 NEW: Reset and ask for another search
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

    // 🎯 SIMPLE USER INPUT SEARCH - ASKS FOR INPUT AND PROVIDES 10+ RESULTS
    async startUserInputSearch() {
        console.log(chalk.yellow.bold('\n🎯 GOOGLE SEARCH WITH USER INPUT'));
        console.log(chalk.gray('='.repeat(45)));
        console.log(chalk.cyan(`   Search #${this.searchCount + 1} - I'll provide at least 10 results!`));
        console.log(chalk.gray('─'.repeat(45)));

        this.rl.question(chalk.magenta('\n🔍 What would you like to search for? '), async (query) => {
            if (!query.trim()) {
                console.log(chalk.red('   ❌ Please enter a valid search query'));
                this.askForAnotherSearch();
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

            // Use the enhanced search to get at least 10 results
            const results = await this.searchWithMultiplePages(query, 10);

            if (results.error || results.items.length === 0) {
                console.log(chalk.red('   ❌ No results found. Please try a different search term.'));
                this.askForAnotherSearch();
                return;
            }

            // Display results
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
            
            // Increment search count
            this.searchCount++;
            
            // Ask if user wants to search again
            this.askForAnotherSearch();
        });
    }

    // Enhanced results display
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

    // HTML Generation Methods
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
                <p><strong>Time:</strong> ${results.searchTime}</p>
                <p><strong>Search #:</strong> ${this.searchCount + 1}</p>
            </div>
        </header>

        <div class="results-container">
            ${results.items.map(item => this.generateResultHTML(item)).join('')}
        </div>

        <footer class="search-footer">
            <p>Generated by Google Search API • ${new Date().toLocaleString()}</p>
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
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background-color: ${bgColor}; 
            color: ${textColor}; 
            line-height: 1.6; 
            padding: 20px;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
        }
        .search-header { 
            background: ${cardBg}; 
            padding: 30px; 
            border-radius: 12px; 
            margin-bottom: 30px; 
            border: 1px solid ${borderColor}; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .search-header h1 { 
            font-size: 2.5em; 
            margin-bottom: 15px; 
            color: ${isDark ? '#4ECDC4' : '#1a73e8'}; 
        }
        .search-info { 
            display: flex; 
            gap: 30px; 
            flex-wrap: wrap; 
        }
        .search-info p { 
            margin: 5px 0; 
            font-size: 1.1em; 
        }
        .results-container { 
            display: flex; 
            flex-direction: column; 
            gap: 20px; 
        }
        .search-result { 
            background: ${cardBg}; 
            border: 1px solid ${borderColor}; 
            border-radius: 12px; 
            padding: 25px; 
            transition: all 0.3s ease; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.05); 
        }
        .search-result:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 4px 15px rgba(0,0,0,0.1); 
        }
        .result-header { 
            display: flex; 
            align-items: center; 
            gap: 10px; 
            margin-bottom: 15px; 
            flex-wrap: wrap; 
        }
        .favicon { 
            width: 16px; 
            height: 16px; 
            border-radius: 2px; 
        }
        .result-position { 
            background: ${isDark ? '#4ECDC4' : '#1a73e8'}; 
            color: white; 
            padding: 2px 8px; 
            border-radius: 12px; 
            font-size: 0.8em; 
            font-weight: bold; 
        }
        .result-link { 
            color: ${isDark ? '#88c999' : '#0d652d'}; 
            text-decoration: none; 
            font-size: 0.9em; 
        }
        .result-link:hover { 
            text-decoration: underline; 
        }
        .result-content { 
            display: grid; 
            grid-template-columns: 1fr auto; 
            gap: 25px; 
            align-items: start; 
        }
        .result-text { 
            flex: 1; 
        }
        .result-title { 
            margin-bottom: 10px; 
        }
        .result-title a { 
            color: ${isDark ? '#4ECDC4' : '#1a0dab'}; 
            text-decoration: none; 
            font-size: 1.3em; 
            font-weight: normal; 
        }
        .result-title a:hover { 
            text-decoration: underline; 
        }
        .result-snippet { 
            color: ${isDark ? '#cccccc' : '#4d5156'}; 
            line-height: 1.5; 
        }
        .result-visual { 
            display: flex; 
            flex-direction: column; 
            gap: 10px; 
            min-width: 200px; 
        }
        .result-thumbnail { 
            width: 200px; 
            height: 150px; 
            border-radius: 8px; 
            object-fit: cover; 
            border: 1px solid ${borderColor}; 
        }
        .result-actions { 
            display: flex; 
            gap: 8px; 
        }
        .visit-btn, .copy-btn { 
            padding: 8px 16px; 
            border: none; 
            border-radius: 6px; 
            cursor: pointer; 
            text-decoration: none; 
            font-size: 0.9em; 
            transition: all 0.2s ease; 
            flex: 1; 
            text-align: center; 
        }
        .visit-btn { 
            background: ${isDark ? '#4ECDC4' : '#1a73e8'}; 
            color: white; 
        }
        .visit-btn:hover { 
            background: ${isDark ? '#45b7af' : '#1669c1'}; 
        }
        .copy-btn { 
            background: ${isDark ? '#555' : '#f1f3f4'}; 
            color: ${textColor}; 
            border: 1px solid ${borderColor}; 
        }
        .copy-btn:hover { 
            background: ${isDark ? '#666' : '#e8eaed'}; 
        }
        .search-footer { 
            text-align: center; 
            margin-top: 40px; 
            padding: 20px; 
            color: ${isDark ? '#888' : '#666'}; 
            border-top: 1px solid ${borderColor}; 
        }
        @media (max-width: 768px) { 
            .result-content { 
                grid-template-columns: 1fr; 
            } 
            .result-visual { 
                align-items: center; 
            } 
            .search-info { 
                flex-direction: column; 
                gap: 10px; 
            } 
        }
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
            case 'darwin': // macOS
                command = `open -a "Google Chrome" "${filepath}"`;
                break;
            case 'win32': // Windows
                command = `start chrome "${filepath}"`;
                break;
            case 'linux': // Linux
                command = `google-chrome "${filepath}"`;
                break;
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

// 🎯 SIMPLE USER INPUT FUNCTION
async function runUserInputDemo() {
    const searchAPI = new GoogleSearchAPI();
    await searchAPI.startUserInputSearch();
}

// 🚀 DEMO FUNCTION
async function runDemo() {
    const searchAPI = new GoogleSearchAPI();
    
    console.log(chalk.yellow.bold('\n🎯 GOOGLE SEARCH API DEMO'));
    console.log(chalk.gray('='.repeat(40)));

    // Example search with at least 10 results
    console.log(chalk.magenta.bold('\n📝 Example Search: Artificial Intelligence'));
    const results = await searchAPI.searchWithMultiplePages('artificial intelligence', 10);
    
    if (results.items.length > 0) {
        searchAPI.displayEnhancedResults(results);
        
        // Generate HTML
        const html = searchAPI.generateHTMLResponse(results, { 
            title: 'AI Search Results' 
        });
        searchAPI.saveHTMLToFile(html, 'demo-ai-search.html');
        
        console.log(chalk.green.bold('\n✅ Demo completed successfully!'));
        console.log(chalk.blue('📁 Check the output folder for HTML files'));
    } else {
        console.log(chalk.yellow('   No results found in demo search'));
    }

    searchAPI.close();
}

// 🎯 COMMAND LINE INTERFACE
async function main() {
    const args = process.argv.slice(2);
    
    try {
        if (args.length === 0) {
            // DEFAULT: Run user input mode with reset functionality
            await runUserInputDemo();
        } else if (args[0] === 'demo') {
            await runDemo();
        } else if (args[0] === 'userinput' || args[0] === 'input') {
            await runUserInputDemo();
        } else if (args[0] === 'search' && args.length > 1) {
            const searchAPI = new GoogleSearchAPI();
            const query = args.slice(1).join(' ');
            const results = await searchAPI.searchWithMultiplePages(query, 10);
            
            if (results.items.length > 0) {
                searchAPI.displayEnhancedResults(results);
                
                const html = searchAPI.generateHTMLResponse(results);
                const filename = `search-${query.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.html`;
                searchAPI.saveHTMLToFile(html, filename);
                
                // Auto-open in Chrome
                searchAPI.openInChrome(path.join(searchAPI.outputDir, filename));
            }
            
            searchAPI.close();
        } else if (args[0] === 'test') {
            const searchAPI = new GoogleSearchAPI();
            console.log(chalk.green.bold('✅ Configuration test passed!'));
            searchAPI.close();
        } else {
            showHelp();
        }
    } catch (error) {
        console.error(chalk.red.bold('💥 Fatal error:'), error.message);
        process.exit(1);
    }
}

function showHelp() {
    console.log(chalk.cyan.bold('\n🎯 Google Search API - Usage Guide'));
    console.log(chalk.gray('='.repeat(45)));
    console.log(chalk.white('\nCommands:'));
    console.log('  npm start                 - 🆕 Ask for user input (Repeatable + Chrome)');
    console.log('  npm run userinput         - Ask for user input (Repeatable + Chrome)');
    console.log('  npm run demo              - Run demo search');
    console.log('  npm run search <query>    - Single search + HTML + Chrome');
    console.log('  npm run test              - Test configuration');
    console.log(chalk.white('\nFeatures:'));
    console.log('  • Asks "What would you like to search for?"');
    console.log('  • Provides at least 10 results');
    console.log('  • Auto-generates HTML reports');
    console.log('  • Auto-opens in Chrome');
    console.log('  • 🆕 ASKS TO SEARCH AGAIN after each search');
    console.log('  • Type "quit" or "exit" to end');
    console.log(chalk.white('\nExamples:'));
    console.log('  npm start                 (asks for input, then asks to search again)');
    console.log('  npm run search "machine learning"');
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