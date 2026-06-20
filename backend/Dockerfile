FROM node:20-alpine

# Install build dependencies if needed (e.g. for native modules)
RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Ensure upload/download directories exist
RUN mkdir -p uploads downloads

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["npm", "start"]
