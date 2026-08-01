const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Sample data storage (in production, use a database)
let scrapedLeads = [];
let scrapingJobs = [];

// Routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Web Scraping Leads Manager</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: #333;
                padding: 20px;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 15px;
                padding: 30px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .header h1 { 
                color: #2c3e50;
                margin-bottom: 10px;
            }
            .dashboard {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
            }
            .card {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                border-left: 4px solid #007bff;
            }
            .card h3 {
                color: #2c3e50;
                margin-bottom: 10px;
            }
            .scraping-form {
                background: #e9ecef;
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 20px;
            }
            .form-group {
                margin-bottom: 15px;
            }
            .form-control {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 16px;
            }
            .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin-right: 10px;
            }
            .btn-primary {
                background: #007bff;
                color: white;
            }
            .btn-success {
                background: #28a745;
                color: white;
            }
            .btn-danger {
                background: #dc3545;
                color: white;
            }
            .leads-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            .leads-table th,
            .leads-table td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }
            .leads-table th {
                background: #2c3e50;
                color: white;
            }
            .leads-table tr:hover {
                background: #f5f5f5;
            }
            .status-badge {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
            }
            .status-active { background: #d4edda; color: #155724; }
            .status-completed { background: #d1ecf1; color: #0c5460; }
            .status-error { background: #f8d7da; color: #721c24; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Web Scraping Leads Manager</h1>
                <p>Complete project to webscrape for leads</p>
            </div>

            <div class="dashboard">
                <div class="card">
                    <h3>📊 Leads Statistics</h3>
                    <p>Total Leads: <span id="totalLeads">0</span></p>
                    <p>Active Jobs: <span id="activeJobs">0</span></p>
                    <p>Success Rate: <span id="successRate">0%</span></p>
                </div>
                <div class="card">
                    <h3>⚡ Quick Actions</h3>
                    <button class="btn btn-primary" onclick="startSampleScraping()">Scrape Sample Sites</button>
                    <button class="btn btn-success" onclick="exportLeads()">Export Leads</button>
                    <button class="btn btn-danger" onclick="clearAllLeads()">Clear All</button>
                </div>
            </div>

            <div class="scraping-form">
                <h3>🔍 Start New Scraping Job</h3>
                <form id="scrapingForm">
                    <div class="form-group">
                        <label>Website URL:</label>
                        <input type="url" class="form-control" id="websiteUrl" 
                               placeholder="https://example.com" required>
                    </div>
                    <div class="form-group">
                        <label>Target Elements (CSS Selectors):</label>
                        <input type="text" class="form-control" id="targetSelector" 
                               placeholder="a[href*='contact'], .email, .phone" required>
                    </div>
                    <div class="form-group">
                        <label>Lead Type:</label>
                        <select class="form-control" id="leadType">
                            <option value="emails">Email Addresses</option>
                            <option value="phones">Phone Numbers</option>
                            <option value="contacts">Contact Information</option>
                            <option value="links">Website Links</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Start Scraping</button>
                </form>
            </div>

            <div>
                <h3>📋 Recent Scraping Jobs</h3>
                <div id="jobsList"></div>
            </div>

            <div>
                <h3>👥 Scraped Leads</h3>
                <div id="leadsList"></div>
            </div>
        </div>

        <script>
            // Load data on page load
            loadDashboardData();
            loadJobs();
            loadLeads();

            // Handle form submission
            document.getElementById('scrapingForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const url = document.getElementById('websiteUrl').value;
                const selector = document.getElementById('targetSelector').value;
                const type = document.getElementById('leadType').value;

                try {
                    const response = await fetch('/api/scrape', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url, selector, type })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('Scraping job started successfully!');
                        document.getElementById('scrapingForm').reset();
                        loadDashboardData();
                        loadJobs();
                        loadLeads();
                    } else {
                        alert('Error: ' + result.error);
                    }
                } catch (error) {
                    console.error('Error starting scraping job:', error);
                    alert('Failed to start scraping job');
                }
            });

            async function loadDashboardData() {
                try {
                    const response = await fetch('/api/dashboard');
                    const data = await response.json();
                    
                    document.getElementById('totalLeads').textContent = data.totalLeads;
                    document.getElementById('activeJobs').textContent = data.activeJobs;
                    document.getElementById('successRate').textContent = data.successRate + '%';
                } catch (error) {
                    console.error('Error loading dashboard:', error);
                }
            }

            async function loadJobs() {
                try {
                    const response = await fetch('/api/jobs');
                    const data = await response.json();
                    
                    const jobsList = document.getElementById('jobsList');
                    jobsList.innerHTML = data.jobs.map(job => \`
                        <div class="card" style="margin-bottom: 10px;">
                            <h4>\${job.url}</h4>
                            <p>Status: <span class="status-badge status-\${job.status}">\${job.status}</span></p>
                            <p>Leads Found: \${job.leadsFound}</p>
                            <p>Started: \${new Date(job.startedAt).toLocaleString()}</p>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Error loading jobs:', error);
                }
            }

            async function loadLeads() {
                try {
                    const response = await fetch('/api/leads');
                    const data = await response.json();
                    
                    const leadsList = document.getElementById('leadsList');
                    if (data.leads.length === 0) {
                        leadsList.innerHTML = '<p>No leads found yet. Start a scraping job above!</p>';
                        return;
                    }
                    
                    leadsList.innerHTML = \`
                        <table class="leads-table">
                            <thead>
                                <tr>
                                    <th>Source</th>
                                    <th>Type</th>
                                    <th>Content</th>
                                    <th>Found At</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${data.leads.map(lead => \`
                                    <tr>
                                        <td>\${lead.source}</td>
                                        <td>\${lead.type}</td>
                                        <td>\${lead.content}</td>
                                        <td>\${new Date(lead.foundAt).toLocaleString()}</td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                } catch (error) {
                    console.error('Error loading leads:', error);
                }
            }

            async function startSampleScraping() {
                const sampleSites = [
                    {
                        url: 'https://httpbin.org/html',
                        selector: 'h1, p',
                        type: 'contacts'
                    },
                    {
                        url: 'https://example.com',
                        selector: 'a, h1',
                        type: 'links'
                    }
                ];

                for (const site of sampleSites) {
                    try {
                        const response = await fetch('/api/scrape', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(site)
                        });
                        await response.json();
                    } catch (error) {
                        console.error('Error scraping sample site:', error);
                    }
                }
                
                alert('Sample scraping jobs started!');
                setTimeout(() => {
                    loadDashboardData();
                    loadJobs();
                    loadLeads();
                }, 2000);
            }

            async function exportLeads() {
                try {
                    const response = await fetch('/api/leads/export');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'leads-export.json';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } catch (error) {
                    console.error('Error exporting leads:', error);
                }
            }

            async function clearAllLeads() {
                if (!confirm('Are you sure you want to clear all leads?')) return;
                
                try {
                    const response = await fetch('/api/leads', { method: 'DELETE' });
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('All leads cleared!');
                        loadDashboardData();
                        loadLeads();
                    }
                } catch (error) {
                    console.error('Error clearing leads:', error);
                }
            }

            // Auto-refresh every 10 seconds
            setInterval(() => {
                loadDashboardData();
                loadJobs();
                loadLeads();
            }, 10000);
        </script>
    </body>
    </html>
  `);
});

// API Routes

// Dashboard statistics
app.get('/api/dashboard', (req, res) => {
  const totalLeads = scrapedLeads.length;
  const activeJobs = scrapingJobs.filter(job => job.status === 'active').length;
  const completedJobs = scrapingJobs.filter(job => job.status === 'completed').length;
  const totalJobs = scrapingJobs.length;
  const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  res.json({
    totalLeads,
    activeJobs,
    successRate,
    totalJobs
  });
});

// Get all scraping jobs
app.get('/api/jobs', (req, res) => {
  res.json({
    success: true,
    jobs: scrapingJobs.slice(-10).reverse() // Show last 10 jobs
  });
});

// Get all leads
app.get('/api/leads', (req, res) => {
  res.json({
    success: true,
    leads: scrapedLeads.slice(-100).reverse() // Show last 100 leads
  });
});

// Export leads
app.get('/api/leads/export', (req, res) => {
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalLeads: scrapedLeads.length,
    leads: scrapedLeads
  };

  res.setHeader('Content-Disposition', 'attachment; filename=leads-export.json');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(exportData, null, 2));
});

// Clear all leads
app.delete('/api/leads', (req, res) => {
  scrapedLeads = [];
  scrapingJobs = [];
  res.json({ success: true, message: 'All leads cleared' });
});

// Main scraping endpoint
app.post('/api/scrape', async (req, res) => {
  const { url, selector, type } = req.body;

  if (!url || !selector) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL and selector are required' 
    });
  }

  const jobId = Date.now().toString();
  const job = {
    id: jobId,
    url,
    selector,
    type,
    status: 'active',
    leadsFound: 0,
    startedAt: new Date().toISOString(),
    completedAt: null
  };

  scrapingJobs.push(job);

  try {
    // Start scraping (non-blocking)
    scrapeWebsite(url, selector, type, jobId);
    
    res.json({ 
      success: true, 
      jobId,
      message: 'Scraping job started successfully' 
    });
  } catch (error) {
    job.status = 'error';
    job.error = error.message;
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start scraping job: ' + error.message 
    });
  }
});

// Scraping function
async function scrapeWebsite(url, selector, type, jobId) {
  try {
    console.log(`Starting to scrape: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const elements = $(selector);
    const leads = [];

    elements.each((index, element) => {
      const content = $(element).text().trim();
      const href = $(element).attr('href');
      
      if (content) {
        let leadType = type;
        let leadContent = content;

        // Auto-detect lead type based on content
        if (content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)) {
          leadType = 'email';
          leadContent = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)[0];
        } else if (content.match(/[\+]?[1-9]{1,4}[\s]?[0-9]{5,15}/) || content.match(/\([0-9]{3}\) [0-9]{3}-[0-9]{4}/)) {
          leadType = 'phone';
        } else if (href && href.startsWith('http')) {
          leadType = 'link';
          leadContent = href;
        }

        const lead = {
          id: Date.now() + index,
          source: url,
          type: leadType,
          content: leadContent,
          originalContent: content,
          foundAt: new Date().toISOString(),
          jobId: jobId
        };

        leads.push(lead);
        scrapedLeads.push(lead);
      }
    });

    // Update job status
    const jobIndex = scrapingJobs.findIndex(job => job.id === jobId);
    if (jobIndex !== -1) {
      scrapingJobs[jobIndex].status = 'completed';
      scrapingJobs[jobIndex].leadsFound = leads.length;
      scrapingJobs[jobIndex].completedAt = new Date().toISOString();
    }

    console.log(`Scraping completed for ${url}. Found ${leads.length} leads.`);

  } catch (error) {
    console.error(`Scraping error for ${url}:`, error.message);
    
    // Update job status to error
    const jobIndex = scrapingJobs.findIndex(job => job.id === jobId);
    if (jobIndex !== -1) {
      scrapingJobs[jobIndex].status = 'error';
      scrapingJobs[jobIndex].error = error.message;
      scrapingJobs[jobIndex].completedAt = new Date().toISOString();
    }
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    leads: scrapedLeads.length,
    jobs: scrapingJobs.length
  });
});

// Echo endpoint
app.post('/api/echo', (req, res) => {
  const { message } = req.body;
  res.json({
    original: message,
    echoed: message,
    timestamp: new Date().toISOString(),
    reversed: message ? message.split('').reverse().join('') : null
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Web Scraping Leads Manager running at http://localhost:' + PORT);
  console.log('🔍 Open http://localhost:' + PORT + ' to start scraping leads');
  console.log('📊 Dashboard: http://localhost:' + PORT + '/api/dashboard');
  console.log('🕒 Started at: ' + new Date().toLocaleString());
});