# Build Stage
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# Pass build environment variables (can be overridden during build)
ARG VITE_API_BASE
ARG VITE_BACKEND_HOST
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_BACKEND_HOST=$VITE_BACKEND_HOST

RUN npm run build

# Production Stage
FROM nginx:alpine
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
