# Use Node.js LTS version
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build the frontend
RUN npm run build

# Expose the port the server runs on
EXPOSE 5051

# Start the server
CMD ["node", "server.js"]
