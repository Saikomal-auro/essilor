# Use an official Node.js runtime as the base image
FROM node:18-alpine 

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the Vite frontend
RUN npm run build

# Set environment variable for Cloud Run
ENV PORT=8080

# Expose the port Vite will run on
EXPOSE 8080

# Use a lightweight HTTP server to serve the built frontend
CMD ["npx", "serve", "-s", "dist", "-l", "8080"]
