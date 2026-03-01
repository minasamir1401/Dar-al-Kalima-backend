# Use official Node.js lightweight image
FROM node:20-slim
LABEL cache-bust="v3-fresh-build"

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install dependencies based on package.json
RUN npm install

# Copy all the remaining backend files
COPY . .

# Expose the port your app runs on
EXPOSE 5000

# Command to run your app
CMD ["npm", "start"]
