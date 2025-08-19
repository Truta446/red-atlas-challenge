# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=development

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS dev
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:api"]

FROM base AS builder
ENV NODE_ENV=development
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN npm run build:full

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist /app/dist
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
