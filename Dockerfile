# Use a lightweight Node.js base image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application (if applicable, adjust as needed for your project)
# For Next.js or similar frameworks:
RUN npm run build

# Expose the port the application listens on
EXPOSE 3000

# Command to start the application
# For a typical Node.js application:
# CMD ["node", "server.js"]
# For Next.js:
CMD ["npm", "start"]