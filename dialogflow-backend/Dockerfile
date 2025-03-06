# Use Node.js 18 as the base image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the entire project
COPY . .

# Expose the port that Cloud Run will use
EXPOSE 8080

# Start the application
CMD ["node", "server.js"]
