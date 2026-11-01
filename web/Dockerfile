FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_PROGRESS_STORE=api
ENV NEXT_PUBLIC_PROGRESS_STORE=$NEXT_PUBLIC_PROGRESS_STORE NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
