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

# Drop root before running. The official node images ship a `node` user
# (UID 1000); we hand it ownership of /app so tsx can read sources but cannot
# write anywhere a privileged process would care about.
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]
