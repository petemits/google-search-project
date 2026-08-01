# complete-project-to-webcrape-f-1762667929011

## Description
complete project to webcrape for leads

## Project Structure
This is a complete Node.js project generated based on your description.

## Features
- Express.js web server
- RESTful API endpoints
- JSON responses
- Health check endpoint
- Easy to extend

## Installation
\`\`\`bash
npm install
\`\`\`

## Running the Project
\`\`\`bash
npm start
\`\`\`

## API Endpoints

### GET /
Returns project information and available endpoints.

### GET /api/health
Health check endpoint.

### POST /api/echo
Echoes your message back with additional information.

## Example Usage

### Get project info:
\`\`\`bash
curl http://localhost:3000/
\`\`\`

### Health check:
\`\`\`bash
curl http://localhost:3000/api/health
\`\`\`

### Echo a message:
\`\`\`bash
curl -X POST -H "Content-Type: application/json" \\\\
  -d '{"message":"Hello World"}' \\\\
  http://localhost:3000/api/echo
\`\`\`
