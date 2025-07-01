# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Clean previous build artifacts and dependencies
RUN rm -rf node_modules package-lock.json

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"] 