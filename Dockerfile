# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of your app's source code
COPY . .

# Expose the port that the app runs on
EXPOSE 3000

# Start the app
CMD ["node", "backend/app.js"]