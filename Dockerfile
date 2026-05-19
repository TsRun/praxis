# Praxis production image: Fastify backend + built SPA, single origin.
FROM node:20-slim

WORKDIR /app

# Install deps first so this layer caches well.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Then the rest of the source.
COPY . .

# Build the SPA (vite) — tsx runs the server from src.
RUN npm run build

ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]
