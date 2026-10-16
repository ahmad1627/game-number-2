FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev --ignore-scripts
COPY . .
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend ./backend
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 5000
CMD ["npm","start"]
